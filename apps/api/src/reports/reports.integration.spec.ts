import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { OrderStatus } from '@prisma/client';

describe('ReportsModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda Reportes Test',
    slug: 'fonda-reportes-test',
    phone: '5550009999',
    ownerName: 'Rosa Flores',
    email: 'rosa@reportes.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    prisma = module.get<PrismaService>(PrismaService);
    await app.init();
  }, 30000);

  afterAll(async () => { await app.close(); }, 15000);

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.extra.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.business.deleteMany();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
  }, 15000);

  // Helper: creates menu + category + product, returns product
  async function createProduct(name = 'Enchiladas Verdes', price = 80) {
    const menu = await prisma.menu.create({
      data: { businessId, name: 'Menú Diario', status: 'PUBLISHED' },
    });
    const category = await prisma.category.create({
      data: { businessId, menuId: menu.id, name: 'Guisados', status: 'ACTIVE', sortOrder: 0 },
    });
    return prisma.product.create({
      data: {
        businessId, categoryId: category.id, name, price,
        isAvailable: true, sortOrder: 0,
      },
    });
  }

  // Helper: creates an order with one item
  async function createOrder(
    opts: { status: OrderStatus; total: number; productId: string; qty?: number; createdAt?: Date },
  ) {
    const order = await prisma.order.create({
      data: {
        businessId,
        orderNumber: `ORD-${Math.random().toString(36).slice(2)}`,
        status: opts.status,
        total: opts.total,
        subtotal: opts.total,
        discount: 0,
        deliveryFee: 0,
        customerName: 'Cliente Test',
        customerPhone: '5551234567',
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: opts.productId,
        quantity: opts.qty ?? 2,
        price: opts.total / (opts.qty ?? 2),
        subtotal: opts.total,
      },
    });
    return order;
  }

  const today = new Date().toISOString().split('T')[0];
  const qs = `startDate=${today}&endDate=${today}`;

  describe('GET /reports/dashboard — auth & permissions', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .expect(401);
    });

    it('returns 403 for OPERATOR role', async () => {
      await request(app.getHttpServer())
        .post('/business/me/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Op Test', email: 'op@test.com', password: 'Password123!', role: 'OPERATOR' });
      const opLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'op@test.com', password: 'Password123!' });
      const opToken = opLoginRes.body.access_token;

      await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${opToken}`)
        .expect(403);
    });

    it('returns 400 when startDate is missing', async () => {
      await request(app.getHttpServer())
        .get('/reports/dashboard?endDate=2026-06-12')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });

    it('returns 400 when endDate is missing', async () => {
      await request(app.getHttpServer())
        .get('/reports/dashboard?startDate=2026-06-12')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });
  });

  describe('GET /reports/dashboard — data', () => {
    it('returns zeroed dashboard when no orders exist', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.summary.totalRevenue).toBe(0);
      expect(res.body.summary.totalOrders).toBe(0);
      expect(res.body.summary.deliveredOrders).toBe(0);
      expect(res.body.summary.cancelledOrders).toBe(0);
      expect(res.body.summary.frequentCustomers).toBe(0);
      expect(res.body.topProducts).toEqual([]);
      expect(res.body.peakHours).toHaveLength(24);
    });

    it('returns correct revenue — excludes CANCELLED orders', async () => {
      const product = await createProduct();
      await createOrder({ status: 'DELIVERED', total: 160, productId: product.id });
      await createOrder({ status: 'CANCELLED', total: 80, productId: product.id });

      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.summary.totalRevenue).toBe(160);
      expect(res.body.summary.totalOrders).toBe(2);
    });

    it('returns correct status breakdown', async () => {
      const product = await createProduct();
      await createOrder({ status: 'DELIVERED', total: 100, productId: product.id });
      await createOrder({ status: 'DELIVERED', total: 100, productId: product.id });
      await createOrder({ status: 'CANCELLED', total: 100, productId: product.id });
      await createOrder({ status: 'IN_PREPARATION', total: 100, productId: product.id });

      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.summary.deliveredOrders).toBe(2);
      expect(res.body.summary.cancelledOrders).toBe(1);
      expect(res.body.summary.confirmedOrders).toBe(1);
    });

    it('returns top products sorted by quantity descending', async () => {
      const p1 = await createProduct('Enchiladas', 80);
      const p2 = await prisma.product.create({
        data: {
          businessId, categoryId: p1.categoryId,
          name: 'Arroz con Pollo', price: 60, isAvailable: true, sortOrder: 1,
        },
      });
      await createOrder({ status: 'DELIVERED', total: 160, productId: p1.id, qty: 2 });
      await createOrder({ status: 'DELIVERED', total: 160, productId: p1.id, qty: 2 });
      await createOrder({ status: 'DELIVERED', total: 60, productId: p2.id, qty: 1 });

      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.topProducts[0].productId).toBe(p1.id);
      expect(res.body.topProducts[0].totalQuantity).toBe(4);
      expect(res.body.topProducts[1].productId).toBe(p2.id);
      expect(res.body.topProducts[1].totalQuantity).toBe(1);
    });

    it('peakHours returns exactly 24 entries (0–23)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.peakHours).toHaveLength(24);
      expect(res.body.peakHours[0].hour).toBe(0);
      expect(res.body.peakHours[23].hour).toBe(23);
    });

    it('excludes orders outside the date range', async () => {
      const product = await createProduct();
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 30);
      await createOrder({ status: 'DELIVERED', total: 999, productId: product.id, createdAt: longAgo });
      await createOrder({ status: 'DELIVERED', total: 100, productId: product.id });

      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.summary.totalOrders).toBe(1);
      expect(res.body.summary.totalRevenue).toBe(100);
    });

    it('does not include other businesses orders', async () => {
      const other = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          businessName: 'Otra Fonda',
          slug: 'otra-fonda-2',
          phone: '5550007777',
          ownerName: 'Pedro Otro',
          email: 'pedro@otro.com',
          password: 'Password123!',
        });
      const otherBusinessId = other.body.business.id;

      const menu = await prisma.menu.create({
        data: { businessId: otherBusinessId, name: 'Menú', status: 'PUBLISHED' },
      });
      const cat = await prisma.category.create({
        data: { businessId: otherBusinessId, menuId: menu.id, name: 'Cat', sortOrder: 0 },
      });
      const prod = await prisma.product.create({
        data: { businessId: otherBusinessId, categoryId: cat.id, name: 'Otro Plato', price: 50, isAvailable: true, sortOrder: 0 },
      });
      const otherOrder = await prisma.order.create({
        data: {
          businessId: otherBusinessId, orderNumber: 'ORD-OTHER',
          status: 'DELIVERED', total: 500, subtotal: 500, discount: 0, deliveryFee: 0,
          customerName: 'X', customerPhone: '5550000000',
        },
      });
      await prisma.orderItem.create({
        data: { orderId: otherOrder.id, productId: prod.id, quantity: 1, price: 500, subtotal: 500 },
      });

      const res = await request(app.getHttpServer())
        .get(`/reports/dashboard?${qs}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.summary.totalOrders).toBe(0);
      expect(res.body.summary.totalRevenue).toBe(0);
    });
  });
});
