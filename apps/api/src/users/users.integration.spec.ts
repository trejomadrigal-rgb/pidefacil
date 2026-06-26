import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Users (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;

  const ownerRegBody = {
    businessName: 'Tacos Don Pedro',
    slug: 'tacos-don-pedro',
    phone: '5552223344',
    ownerName: 'Pedro Ruiz',
    email: 'pedro@tacos.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = module.get<PrismaService>(PrismaService);
    await app.init();
  }, 30000);

  afterAll(async () => { await app.close(); }, 15000);

  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.extra.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.liquidation.deleteMany();
    await prisma.device.deleteMany();
    await prisma.branchProductAvailability.deleteMany();
    await prisma.branchMenuSchedule.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.business.deleteMany();

    const res = await request(app.getHttpServer()).post('/auth/register').send(ownerRegBody);
    ownerToken = res.body.access_token;
  }, 15000);

  describe('POST /business/me/users', () => {
    it('OWNER crea un OPERATOR', async () => {
      const res = await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Ana López', email: 'ana@tacos.com', password: 'Pass1234!', role: 'OPERATOR' })
        .expect(201);

      expect(res.body.email).toBe('ana@tacos.com');
      expect(res.body.role).toBe('OPERATOR');
    });

    it('retorna 409 si email ya existe', async () => {
      await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Ana', email: 'ana@tacos.com', password: 'Pass1234!', role: 'OPERATOR' });

      await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Ana 2', email: 'ana@tacos.com', password: 'Pass1234!', role: 'KITCHEN' })
        .expect(409);
    });

    it('no se puede asignar rol SUPER_ADMIN → 400', async () => {
      await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Hacker', email: 'hacker@test.com', password: 'Pass1234!', role: 'SUPER_ADMIN' })
        .expect(400);
    });
  });

  describe('GET /business/me/users', () => {
    it('retorna solo usuarios del mismo negocio', async () => {
      // Create a second business (different tenant)
      await request(app.getHttpServer()).post('/auth/register').send({
        businessName: 'Otro Negocio',
        slug: 'otro-negocio',
        phone: '5550000000',
        ownerName: 'Otro',
        email: 'otro@negocio.com',
        password: 'Password123!',
      });

      // Add an operator to our business
      await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Operador 1', email: 'op1@tacos.com', password: 'Pass1234!', role: 'OPERATOR' });

      const res = await request(app.getHttpServer())
        .get('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Should only see our own business users (OWNER + OPERATOR = 2)
      expect(res.body.length).toBe(2);
      expect(res.body.every((u: { id: string }) => u.id !== undefined)).toBe(true);
    });
  });

  describe('DELETE /business/me/users/:id (soft delete)', () => {
    it('sets status INACTIVE on the user', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Temp', email: 'temp@tacos.com', password: 'Pass1234!', role: 'OPERATOR' });
      const userId = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/business/me/users/${userId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.status).toBe('INACTIVE');
    });

    it('OWNER cannot deactivate themselves → 422', async () => {
      const userRes = await prisma.user.findUnique({ where: { email: 'pedro@tacos.com' } });
      await request(app.getHttpServer())
        .delete(`/business/me/users/${userRes!.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(422);
    });
  });

  describe('usuario INACTIVE no puede hacer login', () => {
    it('retorna 401 después de ser desactivado', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Worker', email: 'worker@tacos.com', password: 'Pass1234!', role: 'OPERATOR' });
      const userId = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/business/me/users/${userId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'worker@tacos.com', password: 'Pass1234!' })
        .expect(401);
    });
  });
});
