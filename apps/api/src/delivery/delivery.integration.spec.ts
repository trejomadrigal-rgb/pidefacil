import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('DeliveryModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deliveryToken: string;
  let ownerToken: string;
  let businessId: string;
  let orderId: string;
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

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Test1234!', 10);
    const biz = await prisma.business.create({
      data: { name: 'Fonda Delivery Test', slug: `delivery-test-${suffix}`, phone: '5551112233' },
    });
    businessId = biz.id;

    await prisma.user.create({
      data: { businessId, name: 'Owner', email: `owner-del-${suffix}@test.com`, passwordHash: hash, role: 'OWNER' },
    });
    const deliveryUser = await prisma.user.create({
      data: { businessId, name: 'Repartidor', email: `repartidor-${suffix}@test.com`, passwordHash: hash, role: 'DELIVERY' },
    });

    const [ownerLogin, deliveryLogin] = await Promise.all([
      request(app.getHttpServer()).post('/auth/login').send({ email: `owner-del-${suffix}@test.com`, password: 'Test1234!' }),
      request(app.getHttpServer()).post('/auth/login').send({ email: `repartidor-${suffix}@test.com`, password: 'Test1234!' }),
    ]);
    ownerToken = ownerLogin.body.access_token;
    deliveryToken = deliveryLogin.body.access_token;

    // Create a READY order assigned to delivery user
    const menu = await prisma.menu.create({
      data: { businessId, name: 'Menú Test', type: 'FIXED', status: 'PUBLISHED' },
    });
    const category = await prisma.category.create({ data: { businessId, menuId: menu.id, name: 'Cat', status: 'ACTIVE', sortOrder: 0 } });
    const product = await prisma.product.create({
      data: { businessId, categoryId: category.id, name: 'Combo', price: 80, isAvailable: true, noteHints: [] },
    });
    const order = await prisma.order.create({
      data: {
        businessId,
        orderNumber: `DL-${suffix}`,
        status: 'READY',
        subtotal: 80, discount: 0, deliveryFee: 0, total: 80,
        customerName: 'Ana', customerPhone: '5559990000',
        deliveryType: 'DELIVERY', deliveryAddress: 'Calle 1',
        paymentMethod: 'CASH', assignedToId: deliveryUser.id,
        items: { create: { productId: product.id, quantity: 1, price: 80, subtotal: 80 } },
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { businessId } } });
    await prisma.order.deleteMany({ where: { businessId } });
    await prisma.product.deleteMany({ where: { businessId } });
    await prisma.category.deleteMany({ where: { businessId } });
    await prisma.menu.deleteMany({ where: { businessId } });
    await prisma.refreshToken.deleteMany({ where: { user: { businessId } } });
    await prisma.user.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await app.close();
  });

  it('GET /delivery/orders — returns orders assigned to delivery user', async () => {
    const res = await request(app.getHttpServer())
      .get('/delivery/orders')
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((o: { id: string }) => o.id === orderId)).toBe(true);
  });

  it('PATCH /delivery/orders/:id/out-for-delivery — marks order OUT_FOR_DELIVERY', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/delivery/orders/${orderId}/out-for-delivery`)
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OUT_FOR_DELIVERY');
  });

  it('PATCH /delivery/orders/:id/deliver — marks order DELIVERED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/delivery/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DELIVERED');
  });

  it('PATCH /orders/:id/confirm-transfer — admin confirms transfer payment', async () => {
    const menu2 = await prisma.menu.create({
      data: { businessId, name: 'Menú Transfer', type: 'FIXED', status: 'PUBLISHED' },
    });
    const category2 = await prisma.category.create({ data: { businessId, menuId: menu2.id, name: 'Cat2', status: 'ACTIVE', sortOrder: 0 } });
    const product2 = await prisma.product.create({
      data: { businessId, categoryId: category2.id, name: 'Caldo', price: 60, isAvailable: true, noteHints: [] },
    });
    const transferOrder = await prisma.order.create({
      data: {
        businessId, orderNumber: `TF-${suffix}`,
        status: 'CONFIRMED', subtotal: 60, discount: 0, deliveryFee: 0, total: 60,
        customerName: 'Luis', customerPhone: '5558887777',
        deliveryType: 'DELIVERY', deliveryAddress: 'Calle 2',
        paymentMethod: 'TRANSFER', transferConfirmed: false,
        items: { create: { productId: product2.id, quantity: 1, price: 60, subtotal: 60 } },
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/orders/${transferOrder.id}/confirm-transfer`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.transferConfirmed).toBe(true);
    expect(res.body.status).toBe('IN_PREPARATION');
  });
});
