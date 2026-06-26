import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('OrdersModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Primary business data
  let businessId: string;
  let businessSlug: string;
  let productId: string;

  // Second business for cross-tenant tests
  let otherBusinessId: string;
  let otherProductId: string;

  // Track all created order / orderItem IDs for cleanup
  const createdOrderIds: string[] = [];

  // Auth variables for authenticated endpoint tests
  let ownerToken: string;
  let authBusinessId: string;
  let authProductId: string;
  const authOrderIds: string[] = [];

  const suffix = Date.now();

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

    // ── Seed: primary business ──────────────────────────────────────────
    businessSlug = `orders-test-${suffix}`;
    const biz = await prisma.business.create({
      data: {
        name: 'Fonda Pedidos Test',
        slug: businessSlug,
        phone: '5551112233',
        status: 'ACTIVE',
      },
    });
    businessId = biz.id;

    const menu = await prisma.menu.create({
      data: { businessId, name: 'Menú Pedidos', type: 'FIXED' },
    });

    const category = await prisma.category.create({
      data: { businessId, menuId: menu.id, name: 'Platos', status: 'ACTIVE', sortOrder: 0 },
    });

    const product = await prisma.product.create({
      data: {
        businessId,
        categoryId: category.id,
        name: 'Sopa de Lima',
        price: 55,
        isAvailable: true,
      },
    });
    productId = product.id;

    // ── Seed: second business ────────────────────────────────────────────
    const otherBiz = await prisma.business.create({
      data: {
        name: 'Otro Negocio Test',
        slug: `orders-other-${suffix}`,
        phone: '5554445566',
        status: 'ACTIVE',
      },
    });
    otherBusinessId = otherBiz.id;

    const otherMenu = await prisma.menu.create({
      data: { businessId: otherBusinessId, name: 'Menú Otro', type: 'FIXED' },
    });

    const otherCategory = await prisma.category.create({
      data: {
        businessId: otherBusinessId,
        menuId: otherMenu.id,
        name: 'Platos Otros',
        status: 'ACTIVE',
        sortOrder: 0,
      },
    });

    const otherProduct = await prisma.product.create({
      data: {
        businessId: otherBusinessId,
        categoryId: otherCategory.id,
        name: 'Taco Ajeno',
        price: 20,
        isAvailable: true,
      },
    });
    otherProductId = otherProduct.id;

    // ── Auth setup: register owner to get JWT for authenticated tests ──
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        businessName: `Fonda Auth Test ${suffix}`,
        slug: `fonda-auth-${suffix}`,
        phone: '5550001111',
        ownerName: 'Dueño Test',
        email: `owner-${suffix}@test.com`,
        password: 'Password123!',
      })
      .expect(201);
    ownerToken = registerRes.body.access_token;
    authBusinessId = registerRes.body.business.id;

    // Create menu + category + product for authBusiness
    const authMenu = await prisma.menu.create({
      data: { businessId: authBusinessId, name: 'Menú Auth', type: 'FIXED' },
    });
    const authCategory = await prisma.category.create({
      data: {
        businessId: authBusinessId,
        menuId: authMenu.id,
        name: 'Categoría Auth',
        status: 'ACTIVE',
        sortOrder: 0,
      },
    });
    const authProduct = await prisma.product.create({
      data: {
        businessId: authBusinessId,
        categoryId: authCategory.id,
        name: 'Taco Auth',
        price: 25,
        isAvailable: true,
      },
    });
    authProductId = authProduct.id;
  }, 30000);

  afterAll(async () => {
    // Delete orders (FK: orderItems depend on orders and products)
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });

    // Clean up seeded data for both businesses
    await prisma.customer.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.product.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.category.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.menu.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.notification.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.subscription.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.liquidation.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.device.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.branchProductAvailability.deleteMany({ where: { branch: { businessId: { in: [businessId, otherBusinessId] } } } });
    await prisma.branchMenuSchedule.deleteMany({ where: { branch: { businessId: { in: [businessId, otherBusinessId] } } } });
    await prisma.branch.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessId, otherBusinessId] } } });

    // Clean up auth business data
    await prisma.orderItem.deleteMany({ where: { orderId: { in: authOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: authOrderIds } } });
    await prisma.customer.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.product.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.category.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.menu.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.refreshToken.deleteMany({ where: { user: { businessId: authBusinessId } } });
    await prisma.user.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.notification.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.subscription.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.liquidation.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.device.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.branchProductAvailability.deleteMany({ where: { branch: { businessId: authBusinessId } } });
    await prisma.branchMenuSchedule.deleteMany({ where: { branch: { businessId: authBusinessId } } });
    await prisma.branch.deleteMany({ where: { businessId: authBusinessId } });
    await prisma.business.deleteMany({ where: { id: authBusinessId } });

    await app.close();
  }, 30000);

  // ────────────────────────────────────────────────────────────────────────
  // POST /public/orders
  // ────────────────────────────────────────────────────────────────────────
  describe('POST /public/orders', () => {
    const makeBody = (overrides: Record<string, unknown> = {}) => ({
      businessId,
      customer: { name: 'María López', phone: '5559998877' },
      deliveryType: 'PICKUP',
      items: [{ productId, quantity: 1 }],
      ...overrides,
    });

    it('crea un pedido y retorna folio (201 con id, orderNumber, status NEW)', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/orders')
        .send(makeBody())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.orderNumber).toBe('1');
      expect(res.body.status).toBe('NEW');

      createdOrderIds.push(res.body.id);
    });

    it('retorna números de pedido secuenciales (segundo pedido = orderNumber "2")', async () => {
      const first = await request(app.getHttpServer())
        .post('/public/orders')
        .send(makeBody())
        .expect(201);
      createdOrderIds.push(first.body.id);

      const second = await request(app.getHttpServer())
        .post('/public/orders')
        .send(makeBody())
        .expect(201);
      createdOrderIds.push(second.body.id);

      expect(first.body.orderNumber).toBe('2');
      expect(second.body.orderNumber).toBe('3');
    });

    it('retorna 404 para businessId desconocido', async () => {
      await request(app.getHttpServer())
        .post('/public/orders')
        .send(makeBody({ businessId: 'nonexistent-business-id-00000000000' }))
        .expect(404);
    });

    it('retorna 400 con items vacío', async () => {
      await request(app.getHttpServer())
        .post('/public/orders')
        .send(makeBody({ items: [] }))
        .expect(400);
    });

    it('retorna 400 para producto no disponible (isAvailable: false)', async () => {
      // Create an unavailable product for this test
      const unavailableProduct = await prisma.product.create({
        data: {
          businessId,
          categoryId: (await prisma.category.findFirst({ where: { businessId } }))!.id,
          name: 'Producto No Disponible',
          price: 30,
          isAvailable: false,
        },
      });

      try {
        await request(app.getHttpServer())
          .post('/public/orders')
          .send(makeBody({ items: [{ productId: unavailableProduct.id, quantity: 1 }] }))
          .expect(400);
      } finally {
        await prisma.product.delete({ where: { id: unavailableProduct.id } });
      }
    });

    it('retorna 400 para producto de otro negocio', async () => {
      await request(app.getHttpServer())
        .post('/public/orders')
        .send(makeBody({ items: [{ productId: otherProductId, quantity: 1 }] }))
        .expect(400);
    });

    it('retorna 400 para pedido DELIVERY sin dirección', async () => {
      await request(app.getHttpServer())
        .post('/public/orders')
        .send(makeBody({ deliveryType: 'DELIVERY', address: undefined }))
        .expect(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /public/business/:slug/orders/:orderNumber
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /public/business/:slug/orders/:orderNumber', () => {
    let testOrderNumber: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/public/orders')
        .send({
          businessId,
          customer: { name: 'Carlos Ríos', phone: '5551234567' },
          deliveryType: 'PICKUP',
          items: [{ productId, quantity: 2 }],
        })
        .expect(201);

      createdOrderIds.push(res.body.id);
      testOrderNumber = res.body.orderNumber;
    }, 15000);

    it('retorna el estado del pedido con todos los campos requeridos', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}/orders/${testOrderNumber}`)
        .expect(200);

      expect(res.body.orderNumber).toBe(testOrderNumber);
      expect(res.body.status).toBe('NEW');
      expect(typeof res.body.total).toBe('number');
      expect(res.body.deliveryType).toBe('PICKUP');
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items[0]).toHaveProperty('name');
      expect(res.body.items[0]).toHaveProperty('quantity');
      expect(res.body.items[0]).toHaveProperty('subtotal');
      expect(res.body.createdAt).toBeDefined();
    });

    it('retorna 404 para orderNumber desconocido', async () => {
      await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}/orders/99999`)
        .expect(404);
    });

    it('retorna 404 para slug desconocido', async () => {
      await request(app.getHttpServer())
        .get(`/public/business/slug-no-existe-${suffix}/orders/${testOrderNumber}`)
        .expect(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /orders (authenticated)
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /orders', () => {
    let activeOrderId: string;

    beforeAll(async () => {
      // Create one active order for authBusiness
      const res = await request(app.getHttpServer())
        .post('/public/orders')
        .send({
          businessId: authBusinessId,
          customer: { name: 'Cliente Test', phone: '5559998877' },
          deliveryType: 'PICKUP',
          items: [{ productId: authProductId, quantity: 1 }],
        })
        .expect(201);
      activeOrderId = res.body.id;
      authOrderIds.push(activeOrderId);
    }, 15000);

    it('retorna pedidos activos de hoy del negocio autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const order = res.body.find((o: { id: string }) => o.id === activeOrderId);
      expect(order).toBeDefined();
      expect(order.status).toBe('NEW');
      expect(order.customerName).toBe('Cliente Test');
      expect(order.deliveryType).toBe('PICKUP');
      expect(typeof order.total).toBe('number');
      expect(typeof order.itemCount).toBe('number');
      expect(order.itemCount).toBe(1);
      expect(order.orderNumber).toBeDefined();
      expect(order.createdAt).toBeDefined();
    });

    it('no retorna pedidos de otro negocio (aislamiento multi-tenant)', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // businessId belongs to the "Fonda Pedidos Test" — not authBusiness
      const leaked = res.body.find((o: { id: string }) =>
        createdOrderIds.includes(o.id) && !authOrderIds.includes(o.id),
      );
      expect(leaked).toBeUndefined();
    });

    it('no retorna pedidos en estado terminal (DELIVERED)', async () => {
      // Create a DELIVERED order directly in DB
      const deliveredOrder = await prisma.order.create({
        data: {
          businessId: authBusinessId,
          orderNumber: `delivered-${Date.now()}`,
          status: 'DELIVERED',
          subtotal: 25,
          total: 25,
          customerName: 'Entregado Test',
          customerPhone: '5550000000',
          deliveryType: 'PICKUP',
        },
      });
      authOrderIds.push(deliveredOrder.id);

      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const found = res.body.find((o: { id: string }) => o.id === deliveredOrder.id);
      expect(found).toBeUndefined();
    });

    it('retorna 401 sin JWT', async () => {
      await request(app.getHttpServer()).get('/orders').expect(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // GET /orders/:id (authenticated)
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /orders/:id', () => {
    let testOrderId: string;

    beforeAll(async () => {
      // Create directly via Prisma to avoid hitting the HTTP rate limit
      // (the suite already makes 10 POST /public/orders calls before this point)
      const order = await prisma.order.create({
        data: {
          businessId: authBusinessId,
          orderNumber: `detail-${Date.now()}`,
          status: 'NEW',
          customerName: 'Detalle Test',
          customerPhone: '5551234567',
          deliveryType: 'PICKUP',
          subtotal: 50,
          total: 50,
          items: {
            create: [
              {
                productId: authProductId,
                quantity: 2,
                price: 25,
                subtotal: 50,
              },
            ],
          },
        },
      });
      testOrderId = order.id;
      authOrderIds.push(testOrderId);
    }, 15000);

    it('retorna detalle completo del pedido con items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.id).toBe(testOrderId);
      expect(res.body.status).toBe('NEW');
      expect(res.body.customerName).toBe('Detalle Test');
      expect(res.body.customerPhone).toBe('5551234567');
      expect(res.body.deliveryType).toBe('PICKUP');
      expect(res.body.deliveryAddress).toBeNull();
      expect(res.body.subtotal).toBe(50);
      expect(res.body.total).toBe(50);
      expect(res.body.createdAt).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Taco Auth');
      expect(res.body.items[0].quantity).toBe(2);
      expect(res.body.items[0].subtotal).toBe(50);
      expect(res.body.items[0].price).toBeDefined();
      expect(typeof res.body.items[0].price).toBe('number');
      expect(res.body.items[0].notes).toBeNull();
    });

    it('retorna 404 si el pedido pertenece a otro negocio', async () => {
      // createdOrderIds[0] belongs to businessId (the other seeded business)
      await request(app.getHttpServer())
        .get(`/orders/${createdOrderIds[0]}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });

    it('retorna 401 sin JWT', async () => {
      await request(app.getHttpServer()).get(`/orders/${testOrderId}`).expect(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /orders/:id/status (authenticated)
  // ────────────────────────────────────────────────────────────────────────
  describe('PATCH /orders/:id/status', () => {
    let statusOrderId: string;

    beforeEach(async () => {
      // Fresh order in NEW status for each test — use Prisma direct to avoid rate limiter
      const order = await prisma.order.create({
        data: {
          businessId: authBusinessId,
          orderNumber: `status-${Date.now()}`,
          status: 'NEW',
          subtotal: 25,
          total: 25,
          customerName: 'Status Test',
          customerPhone: '5550001234',
          deliveryType: 'PICKUP',
        },
      });
      statusOrderId = order.id;
      authOrderIds.push(statusOrderId);
    }, 15000);

    it('NEW → UNDER_REVIEW: devuelve 200 con status actualizado', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${statusOrderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'UNDER_REVIEW' })
        .expect(200);

      expect(res.body.status).toBe('UNDER_REVIEW');
      expect(res.body.id).toBe(statusOrderId);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('cadena válida NEW → UNDER_REVIEW → CONFIRMED → IN_PREPARATION → READY', async () => {
      const advance = (status: string) =>
        request(app.getHttpServer())
          .patch(`/orders/${statusOrderId}/status`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ status })
          .expect(200);

      await advance('UNDER_REVIEW');
      await advance('CONFIRMED');
      await advance('IN_PREPARATION');
      const res = await advance('READY');

      expect(res.body.status).toBe('READY');
    });

    it('transición inválida IN_PREPARATION → NEW devuelve 400', async () => {
      // Advance to IN_PREPARATION first
      await request(app.getHttpServer())
        .patch(`/orders/${statusOrderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'UNDER_REVIEW' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/orders/${statusOrderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/orders/${statusOrderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'IN_PREPARATION' })
        .expect(200);

      // Try invalid back-transition
      const res = await request(app.getHttpServer())
        .patch(`/orders/${statusOrderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'NEW' })
        .expect(400);

      expect(res.body.message).toContain('Transición inválida');
    });

    it('transición desde estado terminal DELIVERED → READY devuelve 400', async () => {
      // Create a DELIVERED order directly in DB
      const deliveredOrder = await prisma.order.create({
        data: {
          businessId: authBusinessId,
          orderNumber: `terminal-${Date.now()}`,
          status: 'DELIVERED',
          subtotal: 25,
          total: 25,
          customerName: 'Terminal Test',
          customerPhone: '5550009999',
          deliveryType: 'PICKUP',
        },
      });
      authOrderIds.push(deliveredOrder.id);

      await request(app.getHttpServer())
        .patch(`/orders/${deliveredOrder.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'READY' })
        .expect(400);
    });

    it('retorna 404 si el pedido pertenece a otro negocio', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${createdOrderIds[0]}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'UNDER_REVIEW' })
        .expect(404);
    });

    it('retorna 401 sin JWT', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${statusOrderId}/status`)
        .send({ status: 'UNDER_REVIEW' })
        .expect(401);
    });
  });
});
