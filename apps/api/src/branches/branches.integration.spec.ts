import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('BranchesModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda Sucursales Test',
    slug: 'fonda-sucursales-test',
    phone: '5551234567',
    ownerName: 'Dueño Test',
    email: 'owner@sucursales.com',
    password: 'Password123!',
  };

  const branchDto = {
    name: 'Sucursal Centro',
    address: 'Av. Juárez 100, Centro',
    phone: '5559876543',
    latitude: 19.4326,
    longitude: -99.1332,
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

  describe('POST /admin/branches', () => {
    it('crea una sucursal', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(branchDto)
        .expect(201);
      expect(res.body.name).toBe('Sucursal Centro');
      expect(res.body.businessId).toBe(businessId);
      expect(res.body.latitude).toBe(19.4326);
    });

    it('rechaza sin token', async () => {
      await request(app.getHttpServer()).post('/admin/branches').send(branchDto).expect(401);
    });

    it('valida campos requeridos', async () => {
      await request(app.getHttpServer())
        .post('/admin/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sin coords' })
        .expect(400);
    });
  });

  describe('GET /admin/branches', () => {
    it('lista sucursales del negocio', async () => {
      await prisma.branch.create({ data: { businessId, ...branchDto } });
      const res = await request(app.getHttpServer())
        .get('/admin/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Sucursal Centro');
    });
  });

  describe('PATCH /admin/branches/:id', () => {
    it('actualiza nombre de sucursal', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      const res = await request(app.getHttpServer())
        .patch(`/admin/branches/${branch.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sucursal Norte' })
        .expect(200);
      expect(res.body.name).toBe('Sucursal Norte');
    });

    it('retorna 404 si sucursal no pertenece al negocio', async () => {
      await request(app.getHttpServer())
        .patch('/admin/branches/nonexistent')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'X' })
        .expect(404);
    });
  });

  describe('DELETE /admin/branches/:id', () => {
    it('elimina sucursal sin pedidos activos', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      await request(app.getHttpServer())
        .delete(`/admin/branches/${branch.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });
  });

  describe('PUT /admin/branches/:id/menu-schedules', () => {
    it('guarda horario de menú en sucursal', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      const menu = await prisma.menu.create({ data: { businessId, name: 'Menú Diario', type: 'DAILY' } });
      const res = await request(app.getHttpServer())
        .put(`/admin/branches/${branch.id}/menu-schedules`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ schedules: [{ menuId: menu.id, isActive: true, daysOfWeek: [1, 2, 3, 4, 5] }] })
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('PATCH /admin/branches/:id/product-availability', () => {
    it('establece disponibilidad de platillo en sucursal', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      const cat = await prisma.category.create({ data: { businessId, name: 'Platos' } });
      const product = await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Pozole', price: 80, isAvailable: true },
      });
      const res = await request(app.getHttpServer())
        .patch(`/admin/branches/${branch.id}/product-availability`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ items: [{ productId: product.id, isAvailable: false }] })
        .expect(200);
      const item = res.body.find((p: any) => p.productId === product.id);
      expect(item.branchAvailable).toBe(false);
      expect(item.hasOverride).toBe(true);
    });
  });
});
