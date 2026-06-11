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
  }, 30000);

  afterAll(async () => {
    // Delete orders (FK: orderItems depend on orders and products)
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });

    // Clean up seeded data for both businesses
    await prisma.product.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.category.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.menu.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessId, otherBusinessId] } } });

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
});
