import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

const PASSWORD = 'SuperPass1!';
const PASSWORD_HASH =
  '$2b$10$0ZWYxlU4B5dGRlfEl5CP9eUECn6qn30/wL37z/PrSmfw5FftgPORu';

describe('SuperAdmin (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let ownerToken: string;
  let ownerBusinessId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = moduleRef.get(PrismaService);
    await app.init();
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.subscription.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.business.deleteMany();
    await prisma.plan.deleteMany();

    // Seed SUPER_ADMIN (needs a business even though SA doesn't use it)
    const superBiz = await prisma.business.create({
      data: { name: 'PideFacil Admin', slug: 'pidefacil-admin', phone: '0000000000' },
    });
    await prisma.user.create({
      data: {
        businessId: superBiz.id,
        name: 'Super Admin',
        email: 'superadmin@pidefacil.com',
        passwordHash: PASSWORD_HASH,
        role: 'SUPER_ADMIN',
      },
    });
    const superRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'superadmin@pidefacil.com', password: PASSWORD });
    superAdminToken = superRes.body.access_token;

    // Seed OWNER (for 403 tests and business operations)
    const ownerBiz = await prisma.business.create({
      data: { name: 'Test Fonda', slug: 'test-fonda', phone: '5551234567' },
    });
    ownerBusinessId = ownerBiz.id;
    await prisma.user.create({
      data: {
        businessId: ownerBiz.id,
        name: 'Owner',
        email: 'owner@test.com',
        passwordHash: PASSWORD_HASH,
        role: 'OWNER',
      },
    });
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@test.com', password: PASSWORD });
    ownerToken = ownerRes.body.access_token;

    // Seed 3 plans
    await prisma.plan.createMany({
      data: [
        { name: 'Básico', monthlyPrice: 299, maxUsers: 2, maxProducts: 20, maxBranches: 1 },
        { name: 'Pro', monthlyPrice: 499, maxUsers: 5, maxProducts: 100, maxBranches: 1 },
        { name: 'Plus', monthlyPrice: 999, maxUsers: 10, maxProducts: 500, maxBranches: 3 },
      ],
    });
  }, 15000);

  // ─── Dashboard ───────────────────────────────────────────────────────────

  describe('GET /super-admin/dashboard', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/super-admin/dashboard').expect(401);
    });

    it('returns 403 for OWNER', async () => {
      await request(app.getHttpServer())
        .get('/super-admin/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });

    it('returns zeroed metrics when no subscriptions exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/super-admin/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.mrr).toBe(0);
      expect(res.body.activeBusinesses).toBe(0);
      expect(res.body.trialBusinesses).toBe(0);
      expect(res.body.newBusinesses30d).toHaveLength(30);
    });

    it('MRR sums only ACTIVE subscriptions; TRIAL excluded', async () => {
      const pro = await prisma.plan.findFirst({ where: { name: 'Pro' } });
      await prisma.subscription.create({
        data: { businessId: ownerBusinessId, planId: pro!.id, startDate: new Date(), status: 'ACTIVE' },
      });
      const trialBiz = await prisma.business.create({
        data: { name: 'Trial Biz', slug: 'trial-biz', phone: '5550000001' },
      });
      await prisma.subscription.create({
        data: { businessId: trialBiz.id, planId: pro!.id, startDate: new Date(), status: 'TRIAL' },
      });
      const res = await request(app.getHttpServer())
        .get('/super-admin/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.mrr).toBe(499);
      expect(res.body.activeBusinesses).toBe(1);
      expect(res.body.trialBusinesses).toBe(1);
    });
  });

  // ─── Plans ───────────────────────────────────────────────────────────────

  describe('GET /super-admin/plans', () => {
    it('returns all plans', async () => {
      const res = await request(app.getHttpServer())
        .get('/super-admin/plans')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body).toHaveLength(3);
      expect(res.body.map((p: any) => p.name)).toEqual(
        expect.arrayContaining(['Básico', 'Pro', 'Plus']),
      );
    });
  });

  describe('POST /super-admin/plans', () => {
    it('creates plan', async () => {
      const res = await request(app.getHttpServer())
        .post('/super-admin/plans')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Enterprise', monthlyPrice: 1999, maxUsers: 50, maxProducts: 9999, maxBranches: 10 })
        .expect(201);
      expect(res.body.name).toBe('Enterprise');
    });

    it('returns 403 for OWNER', async () => {
      await request(app.getHttpServer())
        .post('/super-admin/plans')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'X', monthlyPrice: 100, maxUsers: 1, maxProducts: 1, maxBranches: 1 })
        .expect(403);
    });
  });

  describe('PATCH /super-admin/plans/:id', () => {
    it('updates monthlyPrice', async () => {
      const plan = await prisma.plan.findFirst({ where: { name: 'Básico' } });
      const res = await request(app.getHttpServer())
        .patch(`/super-admin/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ monthlyPrice: 349 })
        .expect(200);
      expect(Number(res.body.monthlyPrice)).toBe(349);
    });
  });

  describe('DELETE /super-admin/plans/:id', () => {
    it('returns 409 when active subscription exists', async () => {
      const plan = await prisma.plan.findFirst({ where: { name: 'Pro' } });
      await prisma.subscription.create({
        data: { businessId: ownerBusinessId, planId: plan!.id, startDate: new Date(), status: 'ACTIVE' },
      });
      await request(app.getHttpServer())
        .delete(`/super-admin/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(409);
    });

    it('deletes plan with no active subscriptions', async () => {
      const plan = await prisma.plan.findFirst({ where: { name: 'Básico' } });
      await request(app.getHttpServer())
        .delete(`/super-admin/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const found = await prisma.plan.findUnique({ where: { id: plan!.id } });
      expect(found).toBeNull();
    });
  });

  // ─── Businesses ──────────────────────────────────────────────────────────

  describe('GET /super-admin/businesses', () => {
    it('returns all businesses', async () => {
      const res = await request(app.getHttpServer())
        .get('/super-admin/businesses')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by status=SUSPENDED', async () => {
      await prisma.business.update({ where: { id: ownerBusinessId }, data: { status: 'SUSPENDED' } });
      const res = await request(app.getHttpServer())
        .get('/super-admin/businesses?status=SUSPENDED')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe('SUSPENDED');
    });
  });

  describe('POST /super-admin/businesses', () => {
    it('creates business and owner user', async () => {
      const res = await request(app.getHttpServer())
        .post('/super-admin/businesses')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          businessName: 'Nueva Fonda',
          slug: 'nueva-fonda',
          phone: '5558887777',
          ownerName: 'Carlos',
          ownerEmail: 'carlos@nueva.com',
          ownerPassword: 'Pass1234!',
        })
        .expect(201);
      expect(res.body.business.slug).toBe('nueva-fonda');
      expect(res.body.owner.role).toBe('OWNER');
    });
  });

  describe('GET /super-admin/businesses/:id', () => {
    it('returns single business with subscription and plan', async () => {
      const plan = await prisma.plan.findFirst({ where: { name: 'Pro' } });
      await prisma.subscription.create({
        data: { businessId: ownerBusinessId, planId: plan!.id, startDate: new Date(), status: 'ACTIVE' },
      });
      const res = await request(app.getHttpServer())
        .get(`/super-admin/businesses/${ownerBusinessId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.id).toBe(ownerBusinessId);
      expect(res.body.subscription).not.toBeNull();
      expect(res.body.subscription.plan.name).toBe('Pro');
    });
  });

  describe('POST /super-admin/businesses/:id/suspend', () => {
    it('sets business status to SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/super-admin/businesses/${ownerBusinessId}/suspend`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.status).toBe('SUSPENDED');
    });
  });

  describe('POST /super-admin/businesses/:id/activate', () => {
    it('sets business status to ACTIVE', async () => {
      await prisma.business.update({ where: { id: ownerBusinessId }, data: { status: 'SUSPENDED' } });
      const res = await request(app.getHttpServer())
        .post(`/super-admin/businesses/${ownerBusinessId}/activate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.status).toBe('ACTIVE');
    });
  });

  // ─── Subscriptions ───────────────────────────────────────────────────────

  describe('POST /super-admin/subscriptions', () => {
    it('creates subscription', async () => {
      const plan = await prisma.plan.findFirst({ where: { name: 'Pro' } });
      const res = await request(app.getHttpServer())
        .post('/super-admin/subscriptions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          businessId: ownerBusinessId,
          planId: plan!.id,
          startDate: '2026-06-01',
          endDate: '2026-07-01',
          status: 'TRIAL',
        })
        .expect(201);
      expect(res.body.status).toBe('TRIAL');
      expect(res.body.businessId).toBe(ownerBusinessId);
    });

    it('upserts when subscription already exists', async () => {
      const pro = await prisma.plan.findFirst({ where: { name: 'Pro' } });
      const plus = await prisma.plan.findFirst({ where: { name: 'Plus' } });
      await prisma.subscription.create({
        data: { businessId: ownerBusinessId, planId: pro!.id, startDate: new Date(), status: 'TRIAL' },
      });
      const res = await request(app.getHttpServer())
        .post('/super-admin/subscriptions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ businessId: ownerBusinessId, planId: plus!.id, startDate: '2026-06-01', status: 'ACTIVE' })
        .expect(201);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.planId).toBe(plus!.id);
      const count = await prisma.subscription.count({ where: { businessId: ownerBusinessId } });
      expect(count).toBe(1);
    });
  });

  describe('PATCH /super-admin/subscriptions/:id', () => {
    it('updates subscription status', async () => {
      const plan = await prisma.plan.findFirst({ where: { name: 'Pro' } });
      const sub = await prisma.subscription.create({
        data: { businessId: ownerBusinessId, planId: plan!.id, startDate: new Date(), status: 'TRIAL' },
      });
      const res = await request(app.getHttpServer())
        .patch(`/super-admin/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect(res.body.status).toBe('ACTIVE');
    });
  });
});
