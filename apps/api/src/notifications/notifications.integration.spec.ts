import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('NotificationsModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let businessId: string;
  let userId: string;
  let authToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  }, 15000);

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.deviceToken.deleteMany();
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
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.business.deleteMany();

    const business = await prisma.business.create({
      data: { name: 'Test Fonda', slug: `test-fonda-${Date.now()}`, phone: '5551234567', status: 'ACTIVE' },
    });
    businessId = business.id;

    const user = await prisma.user.create({
      data: {
        businessId,
        name: 'Owner Test',
        email: `owner-${Date.now()}@test.com`,
        passwordHash: 'hash',
        role: 'OWNER',
      },
    });
    userId = user.id;
    authToken = jwt.sign({ sub: userId, businessId, role: 'OWNER' });
  });

  describe('POST /notifications/device-token', () => {
    it('registers a device token for the current user', async () => {
      const res = await request(app.getHttpServer())
        .post('/notifications/device-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: 'fcm-token-123', platform: 'ANDROID' });

      expect(res.status).toBe(201);
      const stored = await prisma.deviceToken.findFirst({ where: { token: 'fcm-token-123' } });
      expect(stored).not.toBeNull();
      expect(stored!.userId).toBe(userId);
    });

    it('upserts on duplicate token (idempotent)', async () => {
      await request(app.getHttpServer())
        .post('/notifications/device-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: 'fcm-token-dup', platform: 'ANDROID' });

      await request(app.getHttpServer())
        .post('/notifications/device-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: 'fcm-token-dup', platform: 'IOS' });

      const count = await prisma.deviceToken.count({ where: { token: 'fcm-token-dup' } });
      expect(count).toBe(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/notifications/device-token')
        .send({ token: 'fcm-token-123', platform: 'ANDROID' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid platform value', async () => {
      const res = await request(app.getHttpServer())
        .post('/notifications/device-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: 'fcm-token-123', platform: 'FRIDGE' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /notifications', () => {
    it('returns empty list and zero unreadCount initially', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.unreadCount).toBe(0);
    });

    it('returns notifications for the business with unreadCount', async () => {
      await prisma.notification.create({
        data: { businessId, type: 'NEW_PREORDER', title: 'Nuevo pedido #1', message: 'Cliente · $150' },
      });

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.unreadCount).toBe(1);
      expect(res.body.data[0].title).toBe('Nuevo pedido #1');
      expect(res.body.data[0].isRead).toBe(false);
    });

    it('does not return notifications from another business (cross-tenant)', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Other', slug: `other-biz-${Date.now()}`, phone: '5550000000', status: 'ACTIVE' },
      });
      await prisma.notification.create({
        data: { businessId: otherBiz.id, type: 'NEW_PREORDER', title: 'Not mine', message: 'x' },
      });

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('marks all business notifications as read', async () => {
      await prisma.notification.createMany({
        data: [
          { businessId, type: 'NEW_PREORDER', title: 'N1', message: 'x' },
          { businessId, type: 'NEW_PREORDER', title: 'N2', message: 'x' },
        ],
      });

      const res = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const unread = await prisma.notification.count({ where: { businessId, isRead: false } });
      expect(unread).toBe(0);
    });

    it('does not mark another business notifications as read (cross-tenant)', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Other3', slug: `other-biz3-${Date.now()}`, phone: '5550000002', status: 'ACTIVE' },
      });
      const other = await prisma.notification.create({
        data: { businessId: otherBiz.id, type: 'NEW_PREORDER', title: 'Not mine', message: 'x' },
      });

      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      const unchanged = await prisma.notification.findUnique({ where: { id: other.id } });
      expect(unchanged!.isRead).toBe(false);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks a specific notification as read', async () => {
      const n = await prisma.notification.create({
        data: { businessId, type: 'NEW_PREORDER', title: 'N1', message: 'x' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/notifications/${n.id}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const updated = await prisma.notification.findUnique({ where: { id: n.id } });
      expect(updated!.isRead).toBe(true);
    });

    it('returns 404 when marking another business notification as read (cross-tenant)', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Other2', slug: `other-biz2-${Date.now()}`, phone: '5550000001', status: 'ACTIVE' },
      });
      const n = await prisma.notification.create({
        data: { businessId: otherBiz.id, type: 'NEW_PREORDER', title: 'Not mine', message: 'x' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/notifications/${n.id}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
