import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('CustomersModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda Clientes Test',
    slug: 'fonda-clientes-test',
    phone: '5550001111',
    ownerName: 'María López',
    email: 'maria@clientes.com',
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
    redis = module.get<RedisService>(RedisService);
    await app.init();
  }, 30000);

  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    await prisma.payment.deleteMany();
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

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
  }, 15000);

  describe('GET /customers', () => {
    it('retorna lista vacía cuando no hay clientes', async () => {
      const res = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('retorna clientes del negocio con paginación', async () => {
      await prisma.customer.createMany({
        data: [
          { businessId, name: 'Ana Ruiz', phone: '4421111111', trustLevel: 'NEW' },
          { businessId, name: 'Luis Mora', phone: '4422222222', trustLevel: 'FREQUENT' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.total).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });

    it('filtra por trustLevel', async () => {
      await prisma.customer.createMany({
        data: [
          { businessId, name: 'Ana Ruiz', phone: '4421111111', trustLevel: 'NEW' },
          { businessId, name: 'Luis Mora', phone: '4422222222', trustLevel: 'FREQUENT' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/customers?trustLevel=FREQUENT')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data[0].name).toBe('Luis Mora');
    });

    it('filtra por search (nombre)', async () => {
      await prisma.customer.createMany({
        data: [
          { businessId, name: 'Ana Ruiz', phone: '4421111111' },
          { businessId, name: 'Luis Mora', phone: '4422222222' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/customers?search=ana')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data[0].name).toBe('Ana Ruiz');
    });

    it('filtra por search (teléfono)', async () => {
      await prisma.customer.createMany({
        data: [
          { businessId, name: 'Ana Ruiz', phone: '4421111111' },
          { businessId, name: 'Luis Mora', phone: '4422222222' },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/customers?search=4422')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data[0].name).toBe('Luis Mora');
    });

    it('no retorna clientes de otro negocio', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Otro', slug: 'otro-biz', phone: '5559999999', status: 'ACTIVE' },
      });
      await prisma.customer.create({
        data: { businessId: otherBiz.id, name: 'Foráneo', phone: '4429999999' },
      });

      const res = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.total).toBe(0);
    });

    it('retorna 401 sin token', async () => {
      await request(app.getHttpServer()).get('/customers').expect(401);
    });
  });

  describe('GET /customers/:id', () => {
    it('retorna detalle con historial de pedidos', async () => {
      const customer = await prisma.customer.create({
        data: { businessId, name: 'Pedro Gómez', phone: '4423333333', notes: 'Piso 3' },
      });

      const res = await request(app.getHttpServer())
        .get(`/customers/${customer.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.id).toBe(customer.id);
      expect(res.body.name).toBe('Pedro Gómez');
      expect(res.body.notes).toBe('Piso 3');
      expect(res.body.orders).toEqual([]);
    });

    it('retorna 404 si el cliente no pertenece al negocio', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Otro', slug: 'otro-biz2', phone: '5558888888', status: 'ACTIVE' },
      });
      const otherCustomer = await prisma.customer.create({
        data: { businessId: otherBiz.id, name: 'Ajeno', phone: '4428888888' },
      });

      await request(app.getHttpServer())
        .get(`/customers/${otherCustomer.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('PATCH /customers/:id', () => {
    it('actualiza notes', async () => {
      const customer = await prisma.customer.create({
        data: { businessId, name: 'Carla Vega', phone: '4424444444' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/customers/${customer.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ notes: 'Edificio azul, recepción' })
        .expect(200);

      expect(res.body.notes).toBe('Edificio azul, recepción');
    });

    it('actualiza trustLevel a RISK', async () => {
      const customer = await prisma.customer.create({
        data: { businessId, name: 'Carla Vega', phone: '4424444444' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/customers/${customer.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ trustLevel: 'RISK' })
        .expect(200);

      expect(res.body.trustLevel).toBe('RISK');
    });

    it('retorna 404 si el cliente no pertenece al negocio', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Otro', slug: 'otro-biz3', phone: '5557777777', status: 'ACTIVE' },
      });
      const otherCustomer = await prisma.customer.create({
        data: { businessId: otherBiz.id, name: 'Ajeno', phone: '4427777777' },
      });

      await request(app.getHttpServer())
        .patch(`/customers/${otherCustomer.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ notes: 'hack' })
        .expect(404);
    });
  });

  describe('POST /public/orders — customer upsert', () => {
    let productId: string;

    beforeEach(async () => {
      // Seed a published menu with one product for checkout
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Menú Test', type: 'FIXED', status: 'PUBLISHED' },
      });
      const category = await prisma.category.create({
        data: { businessId, menuId: menu.id, name: 'Platos', status: 'ACTIVE', sortOrder: 0 },
      });
      const product = await prisma.product.create({
        data: { businessId, categoryId: category.id, name: 'Sopa', price: 50, isAvailable: true },
      });
      productId = product.id;
      await prisma.business.update({ where: { id: businessId }, data: { status: 'ACTIVE' } });
    });

    const placeOrder = (overrides: object = {}) =>
      request(app.getHttpServer())
        .post('/public/orders')
        .send({
          businessId,
          customer: { name: 'Ana Ruiz', phone: '4421111111' },
          deliveryType: 'PICKUP',
          items: [{ productId, quantity: 1 }],
          ...overrides,
        });

    it('crea Customer al colocar primer pedido', async () => {
      await placeOrder().expect(201);

      const customer = await prisma.customer.findUnique({
        where: { businessId_phone: { businessId, phone: '4421111111' } },
      });
      expect(customer).not.toBeNull();
      expect(customer!.name).toBe('Ana Ruiz');
      expect(customer!.trustLevel).toBe('NEW');
    });

    it('actualiza nombre y notas en pedido repetido (upsert)', async () => {
      await placeOrder().expect(201);
      await placeOrder({
        customer: { name: 'Ana R. Actualizada', phone: '4421111111' },
        deliveryNotes: 'Piso 2 oficina 5',
      }).expect(201);

      const customer = await prisma.customer.findUnique({
        where: { businessId_phone: { businessId, phone: '4421111111' } },
      });
      expect(customer!.name).toBe('Ana R. Actualizada');
      expect(customer!.notes).toBe('Piso 2 oficina 5');
    });

    it('vincula el pedido al customerId', async () => {
      const res = await placeOrder().expect(201);
      const order = await prisma.order.findUnique({ where: { id: res.body.id } });
      expect(order!.customerId).not.toBeNull();
    });

    it('no sobreescribe notes si deliveryNotes no se envía', async () => {
      await placeOrder({ deliveryNotes: 'Notas previas' }).expect(201);
      // Second order without deliveryNotes
      await placeOrder().expect(201);

      const customer = await prisma.customer.findUnique({
        where: { businessId_phone: { businessId, phone: '4421111111' } },
      });
      expect(customer!.notes).toBe('Notas previas');
    });
  });

  describe('PATCH /orders/:id/status — trust level', () => {
    let ownerToken2: string;
    let businessId2: string;
    let productId2: string;

    beforeEach(async () => {
      // Clear rate limit keys so order placement isn't blocked by previous tests
      const rateLimitKeys = await redis.keys('rate_limit:orders:*');
      if (rateLimitKeys.length > 0) {
        await redis.del(...rateLimitKeys);
      }

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          businessName: 'Fonda Trust Test',
          slug: 'fonda-trust-test',
          phone: '5550002222',
          ownerName: 'Roberto Torres',
          email: 'roberto@trust.com',
          password: 'Password123!',
        });
      ownerToken2 = res.body.access_token;
      businessId2 = res.body.business.id;
      await prisma.business.update({ where: { id: businessId2 }, data: { status: 'ACTIVE' } });

      const menu = await prisma.menu.create({
        data: { businessId: businessId2, name: 'Menú Trust', type: 'FIXED', status: 'PUBLISHED' },
      });
      const category = await prisma.category.create({
        data: { businessId: businessId2, menuId: menu.id, name: 'Platos', status: 'ACTIVE', sortOrder: 0 },
      });
      const product = await prisma.product.create({
        data: { businessId: businessId2, categoryId: category.id, name: 'Tacos', price: 40, isAvailable: true },
      });
      productId2 = product.id;
    });

    const placeOrder = async () => {
      const res = await request(app.getHttpServer())
        .post('/public/orders')
        .send({
          businessId: businessId2,
          customer: { name: 'Juan Pérez', phone: '4425555555' },
          deliveryType: 'PICKUP',
          items: [{ productId: productId2, quantity: 1 }],
        })
        .expect(201);
      return res.body.id as string;
    };

    const advanceToDelivered = async (orderId: string) => {
      const transitions = ['UNDER_REVIEW', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'DELIVERED'];
      for (const status of transitions) {
        await request(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${ownerToken2}`)
          .send({ status });
      }
    };

    it('incrementa totalOrders al entregar pedido', async () => {
      const orderId = await placeOrder();
      await advanceToDelivered(orderId);

      const customer = await prisma.customer.findUnique({
        where: { businessId_phone: { businessId: businessId2, phone: '4425555555' } },
      });
      expect(customer!.totalOrders).toBe(1);
    });

    it('sube a FREQUENT al llegar a 3 pedidos entregados', async () => {
      for (let i = 0; i < 3; i++) {
        const orderId = await placeOrder();
        await advanceToDelivered(orderId);
      }

      const customer = await prisma.customer.findUnique({
        where: { businessId_phone: { businessId: businessId2, phone: '4425555555' } },
      });
      expect(customer!.trustLevel).toBe('FREQUENT');
    }, 30000);

    it('no sube trust level si está en RISK', async () => {
      // Place first order to create customer
      const orderId = await placeOrder();
      // Set customer to RISK with 2 orders (one more would trigger FREQUENT)
      await prisma.customer.update({
        where: { businessId_phone: { businessId: businessId2, phone: '4425555555' } },
        data: { trustLevel: 'RISK', totalOrders: 2 },
      });

      await advanceToDelivered(orderId);

      const customer = await prisma.customer.findUnique({
        where: { businessId_phone: { businessId: businessId2, phone: '4425555555' } },
      });
      expect(customer!.trustLevel).toBe('RISK');
    });
  });
});
