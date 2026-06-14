import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('DevicesModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda Devices Test',
    slug: 'fonda-devices-test',
    phone: '5551234567',
    ownerName: 'Owner Test',
    email: 'owner@devices.com',
    password: 'Password123!',
  };

  const deviceDto = {
    name: 'Tablet Cocina',
    deviceType: 'KITCHEN',
    token: 'unique-device-token-abc123xyz',
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
    await prisma.liquidation.deleteMany();
    await prisma.device.deleteMany();
    await prisma.branchProductAvailability.deleteMany();
    await prisma.branchMenuSchedule.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.extra.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.business.deleteMany();
    await prisma.plan.deleteMany();

    const res = await request(app.getHttpServer()).post('/auth/register').send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
  }, 15000);

  describe('POST /admin/devices/register', () => {
    it('registra dispositivo nuevo como PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(deviceDto)
        .expect(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.deviceId).toBeDefined();
    });

    it('re-registrar el mismo token actualiza lastSeenAt y retorna status existente', async () => {
      await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(deviceDto)
        .expect(201);
      const res = await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(deviceDto)
        .expect(201);
      expect(res.body.status).toBe('PENDING');
    });

    it('retorna 403 si el token está bloqueado', async () => {
      const device = await prisma.device.create({
        data: { businessId, name: 'Blocked', deviceType: 'KITCHEN', token: 'blocked-token-xyz', status: 'BLOCKED' },
      });
      await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ ...deviceDto, token: 'blocked-token-xyz' })
        .expect(403);
    });

    it('rechaza sin token de autenticación', async () => {
      await request(app.getHttpServer()).post('/admin/devices/register').send(deviceDto).expect(401);
    });

    it('valida campos requeridos', async () => {
      await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sin tipo' })
        .expect(400);
    });
  });

  describe('GET /admin/devices', () => {
    it('lista dispositivos del negocio', async () => {
      await prisma.device.create({
        data: { businessId, name: 'Tablet', deviceType: 'RECEPTION', token: 'list-tok-123' },
      });
      const res = await request(app.getHttpServer())
        .get('/admin/devices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Tablet');
    });
  });

  describe('PATCH /admin/devices/:id/approve', () => {
    it('aprueba un dispositivo pendiente', async () => {
      const device = await prisma.device.create({
        data: { businessId, name: 'Tablet', deviceType: 'KITCHEN', token: 'approve-tok-123' },
      });
      const res = await request(app.getHttpServer())
        .patch(`/admin/devices/${device.id}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(200);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('retorna 404 si dispositivo no pertenece al negocio', async () => {
      await request(app.getHttpServer())
        .patch('/admin/devices/nonexistent/approve')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(404);
    });
  });

  describe('PATCH /admin/devices/:id/block', () => {
    it('bloquea un dispositivo activo', async () => {
      const device = await prisma.device.create({
        data: { businessId, name: 'Tablet', deviceType: 'RECEPTION', token: 'block-tok-123', status: 'ACTIVE' },
      });
      const res = await request(app.getHttpServer())
        .patch(`/admin/devices/${device.id}/block`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.status).toBe('BLOCKED');
    });
  });

  describe('DELETE /admin/devices/:id', () => {
    it('elimina un dispositivo', async () => {
      const device = await prisma.device.create({
        data: { businessId, name: 'Tablet', deviceType: 'DELIVERY', token: 'del-tok-123' },
      });
      await request(app.getHttpServer())
        .delete(`/admin/devices/${device.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });
  });
});
