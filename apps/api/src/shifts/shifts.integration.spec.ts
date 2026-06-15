import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('ShiftsModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let deliveryUserId: string;
  let shiftId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = module.get<PrismaService>(PrismaService);
    await app.init();

    const biz = await prisma.business.create({
      data: { name: 'Fonda Turnos', slug: `shifts-test-${suffix}`, phone: '5551112233' },
    });
    businessId = biz.id;

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Test1234!', 10);
    await prisma.user.create({
      data: { businessId, name: 'Owner', email: `owner-shifts-${suffix}@test.com`, passwordHash: hash, role: 'OWNER' },
    });

    const delivery = await prisma.user.create({
      data: { businessId, name: 'Repartidor Juan', email: `delivery-${suffix}@test.com`, passwordHash: hash, role: 'DELIVERY' },
    });
    deliveryUserId = delivery.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `owner-shifts-${suffix}@test.com`, password: 'Test1234!' });
    ownerToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await prisma.shift.deleteMany({ where: { businessId } });
    await prisma.refreshToken.deleteMany({ where: { user: { businessId } } });
    await prisma.user.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await app.close();
  });

  it('POST /shifts — creates a shift', async () => {
    const res = await request(app.getHttpServer())
      .post('/shifts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deliveryUserId });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.deliveryUserId).toBe(deliveryUserId);
    shiftId = res.body.id;
  });

  it('GET /shifts — lists shifts for business', async () => {
    const res = await request(app.getHttpServer())
      .get('/shifts')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((s: { id: string }) => s.id === shiftId)).toBe(true);
  });

  it('PATCH /shifts/:id/close — closes the shift', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLOSED');
  });
});
