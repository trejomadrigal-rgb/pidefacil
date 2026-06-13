# Phase 8 — Super Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Super Admin area to PideFacil — Plans CRUD, Business management, Subscription assignment, and a SaaS dashboard — all behind a dedicated `/super/*` section in `apps/admin` and a `SuperAdminModule` in the API.

**Architecture:** Single `SuperAdminModule` at `/super-admin/*` (all endpoints gated with `@Roles(Role.SUPER_ADMIN)`). Admin UI lives at `apps/admin/src/app/(super)/super/*` with its own layout + sidebar. `BusinessModule` exports `BusinessService` so `SuperAdminService` can call `createBusiness` without duplicating logic.

**Tech Stack:** NestJS API (Prisma, class-validator), Next.js 15 admin (TanStack Query, Tailwind/CSS — no recharts), TypeScript.

---

## File Map

**API — new files:**
- `apps/api/src/super-admin/super-admin.module.ts`
- `apps/api/src/super-admin/super-admin.controller.ts`
- `apps/api/src/super-admin/super-admin.service.ts`
- `apps/api/src/super-admin/dto/create-plan.dto.ts`
- `apps/api/src/super-admin/dto/update-plan.dto.ts`
- `apps/api/src/super-admin/dto/create-subscription.dto.ts`
- `apps/api/src/super-admin/dto/update-subscription.dto.ts`
- `apps/api/src/super-admin/dto/update-business.dto.ts`
- `apps/api/src/super-admin/super-admin.integration.spec.ts`

**API — modified files:**
- `apps/api/src/business/business.module.ts` — add `exports: [BusinessService]`
- `apps/api/src/business/business.controller.ts` — remove `POST /admin/businesses`
- `apps/api/src/business/business.integration.spec.ts` — update route in 2 tests
- `apps/api/src/app.module.ts` — add `SuperAdminModule`

**Admin — new files:**
- `apps/admin/src/api/super-admin.ts`
- `apps/admin/src/hooks/use-super-admin.ts`
- `apps/admin/src/components/layout/super-sidebar.tsx`
- `apps/admin/src/components/layout/super-shell.tsx`
- `apps/admin/src/app/(super)/layout.tsx`
- `apps/admin/src/app/(super)/super/dashboard/page.tsx`
- `apps/admin/src/app/(super)/super/dashboard/components/sa-kpi-cards.tsx`
- `apps/admin/src/app/(super)/super/dashboard/components/sa-plan-donut.tsx`
- `apps/admin/src/app/(super)/super/dashboard/components/sa-new-biz-chart.tsx`
- `apps/admin/src/app/(super)/super/dashboard/components/sa-biz-table.tsx`
- `apps/admin/src/app/(super)/super/negocios/page.tsx`
- `apps/admin/src/app/(super)/super/negocios/nuevo/page.tsx`
- `apps/admin/src/app/(super)/super/negocios/[id]/page.tsx`
- `apps/admin/src/app/(super)/super/planes/page.tsx`

**Admin — modified files:**
- `apps/admin/src/middleware.ts` — add `/super/:path*` to matcher

---

## Context for subagents

- Repo: `/Users/alextrejo/Desktop/Claude/pidefacil`
- Branch: `main`
- Spec: `docs/superpowers/specs/2026-06-12-phase-8-super-admin.md`
- Design system: primary `#FF6B35`, dark nav `#1A1A2E`, Plus Jakarta Sans + Inter
- `PrismaModule` is `@Global()` — no need to import it in `SuperAdminModule`
- `Plan.monthlyPrice` is Prisma `Decimal` → use `Number()` when building response objects
- Existing SUPER_ADMIN test pattern: create business + user with `role: 'SUPER_ADMIN'`, hash of `'SuperPass1!'` is `$2b$10$0ZWYxlU4B5dGRlfEl5CP9eUECn6qn30/wL37z/PrSmfw5FftgPORu`
- Auth store: `useAuthStore` from `@/store/auth.store` — has `accessToken: string | null`, no `role` field. Decode role from JWT payload: `JSON.parse(atob(token.split('.')[1])).role`
- Admin API axios instance: `api` from `@/lib/api` — already has Bearer token interceptor
- Run tests: `NODE_OPTIONS=--experimental-vm-modules pnpm --filter @pidefacil/api test --runInBand`
- TypeScript check: `pnpm --filter @pidefacil/api exec tsc --noEmit` (same pattern for admin/mobile)

---

## Task 1: API — SuperAdminModule (TDD)

**Files:**
- Create: `apps/api/src/super-admin/super-admin.integration.spec.ts`
- Create: `apps/api/src/super-admin/dto/create-plan.dto.ts`
- Create: `apps/api/src/super-admin/dto/update-plan.dto.ts`
- Create: `apps/api/src/super-admin/dto/create-subscription.dto.ts`
- Create: `apps/api/src/super-admin/dto/update-subscription.dto.ts`
- Create: `apps/api/src/super-admin/dto/update-business.dto.ts`
- Create: `apps/api/src/super-admin/super-admin.service.ts`
- Create: `apps/api/src/super-admin/super-admin.controller.ts`
- Create: `apps/api/src/super-admin/super-admin.module.ts`
- Modify: `apps/api/src/business/business.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the integration spec**

Create `apps/api/src/super-admin/super-admin.integration.spec.ts`:

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
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
```

- [ ] **Step 2: Create DTOs**

Create `apps/api/src/super-admin/dto/create-plan.dto.ts`:
```typescript
import { IsString, IsNotEmpty, IsNumber, IsInt, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() @Min(0) monthlyPrice!: number;
  @IsInt() @Min(1) maxUsers!: number;
  @IsInt() @Min(1) maxProducts!: number;
  @IsInt() @Min(1) maxBranches!: number;
}
```

Create `apps/api/src/super-admin/dto/update-plan.dto.ts`:
```typescript
import { IsString, IsNotEmpty, IsNumber, IsInt, Min, IsOptional } from 'class-validator';

export class UpdatePlanDto {
  @IsString() @IsNotEmpty() @IsOptional() name?: string;
  @IsNumber() @Min(0) @IsOptional() monthlyPrice?: number;
  @IsInt() @Min(1) @IsOptional() maxUsers?: number;
  @IsInt() @Min(1) @IsOptional() maxProducts?: number;
  @IsInt() @Min(1) @IsOptional() maxBranches?: number;
}
```

Create `apps/api/src/super-admin/dto/create-subscription.dto.ts`:
```typescript
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsString() @IsNotEmpty() businessId!: string;
  @IsString() @IsNotEmpty() planId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsEnum(SubscriptionStatus) status!: SubscriptionStatus;
}
```

Create `apps/api/src/super-admin/dto/update-subscription.dto.ts`:
```typescript
import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class UpdateSubscriptionDto {
  @IsString() @IsOptional() planId?: string;
  @IsDateString() @IsOptional() startDate?: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsEnum(SubscriptionStatus) @IsOptional() status?: SubscriptionStatus;
}
```

Create `apps/api/src/super-admin/dto/update-business.dto.ts`:
```typescript
import { IsString, IsOptional } from 'class-validator';

export class UpdateBusinessDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() whatsapp?: string;
  @IsString() @IsOptional() timezone?: string;
}
```

- [ ] **Step 3: Create the service**

Create `apps/api/src/super-admin/super-admin.service.ts`:

```typescript
import { ConflictException, Injectable } from '@nestjs/common';
import { BusinessStatus } from '@prisma/client';
import { BusinessService } from '../business/business.service';
import { CreateBusinessDto } from '../business/dto/create-business.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessService: BusinessService,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────

  async getDashboard() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [subscriptions, totalOrders30d, recentBusinesses] = await Promise.all([
      this.prisma.subscription.findMany({ include: { plan: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.business.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const mrr = subscriptions
      .filter(s => s.status === 'ACTIVE')
      .reduce((sum, s) => sum + Number(s.plan.monthlyPrice), 0);

    const activeBusinesses = subscriptions.filter(s => s.status === 'ACTIVE').length;
    const trialBusinesses = subscriptions.filter(s => s.status === 'TRIAL').length;

    // businessesByPlan
    const planMap = new Map<string, number>();
    for (const sub of subscriptions) {
      planMap.set(sub.plan.name, (planMap.get(sub.plan.name) ?? 0) + 1);
    }
    const businessesByPlan = Array.from(planMap.entries()).map(([planName, count]) => ({
      planName,
      count,
    }));

    // newBusinesses30d — exactly 30 entries, zero-filled
    const buckets: Record<string, number> = {};
    for (const biz of recentBusinesses) {
      const day = biz.createdAt.toISOString().slice(0, 10);
      buckets[day] = (buckets[day] ?? 0) + 1;
    }
    const newBusinesses30d = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const day = d.toISOString().slice(0, 10);
      return { date: day, count: buckets[day] ?? 0 };
    });

    return { mrr, activeBusinesses, trialBusinesses, totalOrders30d, businessesByPlan, newBusinesses30d };
  }

  // ── Plans ─────────────────────────────────────────────────────────────

  getPlans() {
    return this.prisma.plan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  }

  createPlan(dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: dto });
  }

  updatePlan(id: string, dto: UpdatePlanDto) {
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  async deletePlan(id: string) {
    const activeCount = await this.prisma.subscription.count({
      where: { planId: id, status: { in: ['ACTIVE', 'TRIAL'] } },
    });
    if (activeCount > 0) {
      throw new ConflictException('Cannot delete a plan with active or trial subscriptions');
    }
    return this.prisma.plan.delete({ where: { id } });
  }

  // ── Businesses ────────────────────────────────────────────────────────

  getBusinesses(status?: BusinessStatus) {
    return this.prisma.business.findMany({
      where: status ? { status } : undefined,
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  getBusinessById(id: string) {
    return this.prisma.business.findUniqueOrThrow({
      where: { id },
      include: { subscription: { include: { plan: true } } },
    });
  }

  createBusiness(dto: CreateBusinessDto) {
    return this.businessService.createBusiness(dto);
  }

  updateBusiness(id: string, dto: UpdateBusinessDto) {
    return this.prisma.business.update({ where: { id }, data: dto });
  }

  suspendBusiness(id: string) {
    return this.prisma.business.update({ where: { id }, data: { status: 'SUSPENDED' } });
  }

  activateBusiness(id: string) {
    return this.prisma.business.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  // ── Subscriptions ─────────────────────────────────────────────────────

  upsertSubscription(dto: CreateSubscriptionDto) {
    return this.prisma.subscription.upsert({
      where: { businessId: dto.businessId },
      create: {
        businessId: dto.businessId,
        planId: dto.planId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status,
      },
      update: {
        planId: dto.planId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status,
      },
    });
  }

  updateSubscription(id: string, dto: UpdateSubscriptionDto) {
    return this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.planId && { planId: dto.planId }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }
}
```

- [ ] **Step 4: Create the controller**

Create `apps/api/src/super-admin/super-admin.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BusinessStatus } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateBusinessDto } from '../business/dto/create-business.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SuperAdminService } from './super-admin.service';

@Controller('super-admin')
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.superAdminService.getDashboard();
  }

  @Get('plans')
  getPlans() {
    return this.superAdminService.getPlans();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.superAdminService.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.superAdminService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.superAdminService.deletePlan(id);
  }

  @Get('businesses')
  getBusinesses(@Query('status') status?: BusinessStatus) {
    return this.superAdminService.getBusinesses(status);
  }

  @Post('businesses')
  createBusiness(@Body() dto: CreateBusinessDto) {
    return this.superAdminService.createBusiness(dto);
  }

  @Get('businesses/:id')
  getBusiness(@Param('id') id: string) {
    return this.superAdminService.getBusinessById(id);
  }

  @Patch('businesses/:id')
  updateBusiness(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.superAdminService.updateBusiness(id, dto);
  }

  @Post('businesses/:id/suspend')
  suspendBusiness(@Param('id') id: string) {
    return this.superAdminService.suspendBusiness(id);
  }

  @Post('businesses/:id/activate')
  activateBusiness(@Param('id') id: string) {
    return this.superAdminService.activateBusiness(id);
  }

  @Post('subscriptions')
  upsertSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.superAdminService.upsertSubscription(dto);
  }

  @Patch('subscriptions/:id')
  updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.superAdminService.updateSubscription(id, dto);
  }
}
```

- [ ] **Step 5: Create the module**

Create `apps/api/src/super-admin/super-admin.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

@Module({
  imports: [BusinessModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
```

- [ ] **Step 6: Export BusinessService from BusinessModule**

In `apps/api/src/business/business.module.ts`, add `exports`:

```typescript
import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [PublicModule],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
```

- [ ] **Step 7: Register SuperAdminModule in app.module.ts**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { SuperAdminModule } from './super-admin/super-admin.module';
```

And add `SuperAdminModule` to the `imports` array after `ReportsModule`:

```typescript
    ReportsModule,
    SuperAdminModule,
```

- [ ] **Step 8: Run the integration spec**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
NODE_OPTIONS=--experimental-vm-modules pnpm --filter @pidefacil/api test --testPathPattern="super-admin.integration" --runInBand 2>&1 | tail -30
```

Expected: all tests pass (17 tests).

- [ ] **Step 9: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/api/src/super-admin/ apps/api/src/business/business.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): add SuperAdminModule with dashboard, plans, businesses, subscriptions"
```

---

## Task 2: Remove old endpoint from BusinessModule

**Files:**
- Modify: `apps/api/src/business/business.controller.ts`
- Modify: `apps/api/src/business/business.integration.spec.ts`

- [ ] **Step 1: Remove the endpoint from BusinessController**

In `apps/api/src/business/business.controller.ts`, remove these lines (lines 27–31):

```typescript
  @Post('admin/businesses')
  @Roles(Role.SUPER_ADMIN)
  createBusiness(@Body() dto: CreateBusinessDto) {
    return this.businessService.createBusiness(dto);
  }
```

Also remove the `CreateBusinessDto` import if it's only used by this endpoint. Check: search for `CreateBusinessDto` in the file. If no other method uses it, remove the import line.

- [ ] **Step 2: Update business.integration.spec.ts**

In `apps/api/src/business/business.integration.spec.ts`, find the two tests in `describe('POST /admin/businesses', ...)` (around lines 111–135).

Change the route in both tests from `/admin/businesses` to `/super-admin/businesses`:

```typescript
  describe('POST /super-admin/businesses', () => {
    it('SUPER_ADMIN crea negocio con OWNER', async () => {
      const res = await request(app.getHttpServer())
        .post('/super-admin/businesses')         // ← changed
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ ... })
        .expect(201);
      ...
    });

    it('OWNER no puede crear negocios → 403', async () => {
      await request(app.getHttpServer())
        .post('/super-admin/businesses')         // ← changed
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ ... })
        .expect(403);
    });
  });
```

- [ ] **Step 3: Run business integration tests**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
NODE_OPTIONS=--experimental-vm-modules pnpm --filter @pidefacil/api test --testPathPattern="business.integration" --runInBand 2>&1 | tail -20
```

Expected: all business tests pass (the 2 updated tests now hit the new route).

- [ ] **Step 4: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/api/src/business/business.controller.ts apps/api/src/business/business.integration.spec.ts
git commit -m "feat(api): move POST /admin/businesses to SuperAdminModule"
```

---

## Task 3: Admin — Layout + Middleware + API client + Hooks

**Files:**
- Create: `apps/admin/src/components/layout/super-sidebar.tsx`
- Create: `apps/admin/src/components/layout/super-shell.tsx`
- Create: `apps/admin/src/app/(super)/layout.tsx`
- Modify: `apps/admin/src/middleware.ts`
- Create: `apps/admin/src/api/super-admin.ts`
- Create: `apps/admin/src/hooks/use-super-admin.ts`

- [ ] **Step 1: Create SuperSidebar**

Create `apps/admin/src/components/layout/super-sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const navItems = [
  { href: '/super/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/super/negocios', icon: Building2, label: 'Negocios' },
  { href: '/super/planes', icon: CreditCard, label: 'Planes' },
];

export function SuperSidebar() {
  const pathname = usePathname();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <aside className="w-56 bg-[#1A1A2E] flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-5 border-b border-white/10">
        <span className="text-[#FF6B35] font-black text-base">PideFacil</span>
        <p className="text-white/40 text-[10px] mt-0.5">Super Admin</p>
      </div>
      <nav className="flex-1 py-3">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35] border-r-2 border-[#FF6B35]'
                  : 'text-white/55 hover:text-white/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <button
          onClick={() => {
            clearAuth();
            window.location.href = '/login';
          }}
          className="text-white/40 text-xs hover:text-white/70 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create SuperShell**

Create `apps/admin/src/components/layout/super-shell.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { SuperSidebar } from './super-sidebar';

function decodeRole(token: string | null): string | null {
  if (!token) return null;
  try {
    return (JSON.parse(atob(token.split('.')[1])) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

export function SuperShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    const role = decodeRole(accessToken);
    if (role !== null && role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    } else if (accessToken === null) {
      router.replace('/login');
    }
  }, [accessToken, router]);

  return (
    <div className="flex h-screen overflow-hidden">
      <SuperSidebar />
      <main className="flex-1 overflow-auto bg-[#F5F5F5] h-full">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create the (super) layout**

Create `apps/admin/src/app/(super)/layout.tsx`:

```typescript
import { SuperShell } from '@/components/layout/super-shell';

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return <SuperShell>{children}</SuperShell>;
}
```

- [ ] **Step 4: Update middleware**

In `apps/admin/src/middleware.ts`, add `/super/:path*`, `/reportes`, and `/reportes/:path*` to the matcher:

```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/menus/:path*',
    '/settings/:path*',
    '/users/:path*',
    '/clientes/:path*',
    '/clientes',
    '/reportes/:path*',
    '/reportes',
    '/super/:path*',
  ],
};
```

Keep the existing `middleware` function body unchanged — it only needs to stay as-is (checks `rf_token` cookie).

- [ ] **Step 5: Create API client**

Create `apps/admin/src/api/super-admin.ts`:

```typescript
import { api } from '@/lib/api';

export interface SaBizByPlan { planName: string; count: number; }
export interface SaNewBiz { date: string; count: number; }

export interface SaDashboard {
  mrr: number;
  activeBusinesses: number;
  trialBusinesses: number;
  totalOrders30d: number;
  businessesByPlan: SaBizByPlan[];
  newBusinesses30d: SaNewBiz[];
}

export interface SaPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  maxUsers: number;
  maxProducts: number;
  maxBranches: number;
}

export interface SaSubscription {
  id: string;
  businessId: string;
  planId: string;
  startDate: string;
  endDate: string | null;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  plan: SaPlan;
}

export interface SaBusiness {
  id: string;
  name: string;
  slug: string;
  phone: string;
  whatsapp: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  createdAt: string;
  subscription: SaSubscription | null;
}

export interface CreateBusinessPayload {
  businessName: string;
  slug: string;
  phone: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface UpsertSubscriptionPayload {
  businessId: string;
  planId: string;
  startDate: string;
  endDate?: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
}

export interface UpdateSubscriptionPayload {
  planId?: string;
  startDate?: string;
  endDate?: string | null;
  status?: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
}

export async function getSaDashboard(): Promise<SaDashboard> {
  return (await api.get<SaDashboard>('/super-admin/dashboard')).data;
}

export async function getSaPlans(): Promise<SaPlan[]> {
  return (await api.get<SaPlan[]>('/super-admin/plans')).data;
}

export async function createSaPlan(data: Omit<SaPlan, 'id'>): Promise<SaPlan> {
  return (await api.post<SaPlan>('/super-admin/plans', data)).data;
}

export async function updateSaPlan(id: string, data: Partial<Omit<SaPlan, 'id'>>): Promise<SaPlan> {
  return (await api.patch<SaPlan>(`/super-admin/plans/${id}`, data)).data;
}

export async function deleteSaPlan(id: string): Promise<void> {
  await api.delete(`/super-admin/plans/${id}`);
}

export async function getSaBusinesses(status?: string): Promise<SaBusiness[]> {
  return (await api.get<SaBusiness[]>('/super-admin/businesses', { params: status ? { status } : undefined })).data;
}

export async function getSaBusiness(id: string): Promise<SaBusiness> {
  return (await api.get<SaBusiness>(`/super-admin/businesses/${id}`)).data;
}

export async function createSaBusiness(
  data: CreateBusinessPayload,
): Promise<{ business: SaBusiness; owner: { id: string; role: string } }> {
  return (await api.post('/super-admin/businesses', data)).data;
}

export async function updateSaBusiness(
  id: string,
  data: { name?: string; phone?: string; whatsapp?: string; timezone?: string },
): Promise<SaBusiness> {
  return (await api.patch<SaBusiness>(`/super-admin/businesses/${id}`, data)).data;
}

export async function suspendSaBusiness(id: string): Promise<SaBusiness> {
  return (await api.post<SaBusiness>(`/super-admin/businesses/${id}/suspend`)).data;
}

export async function activateSaBusiness(id: string): Promise<SaBusiness> {
  return (await api.post<SaBusiness>(`/super-admin/businesses/${id}/activate`)).data;
}

export async function upsertSaSubscription(data: UpsertSubscriptionPayload): Promise<SaSubscription> {
  return (await api.post<SaSubscription>('/super-admin/subscriptions', data)).data;
}

export async function updateSaSubscription(
  id: string,
  data: UpdateSubscriptionPayload,
): Promise<SaSubscription> {
  return (await api.patch<SaSubscription>(`/super-admin/subscriptions/${id}`, data)).data;
}
```

- [ ] **Step 6: Create TanStack Query hooks**

Create `apps/admin/src/hooks/use-super-admin.ts`:

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateBusinessPayload,
  UpdateSubscriptionPayload,
  UpsertSubscriptionPayload,
  activateSaBusiness,
  createSaBusiness,
  createSaPlan,
  deleteSaPlan,
  getSaBusiness,
  getSaBusinesses,
  getSaDashboard,
  getSaPlans,
  suspendSaBusiness,
  updateSaBusiness,
  updateSaPlan,
  updateSaSubscription,
  upsertSaSubscription,
} from '@/api/super-admin';

export function useSaDashboard() {
  return useQuery({ queryKey: ['sa', 'dashboard'], queryFn: getSaDashboard, staleTime: 60_000 });
}

export function useSaPlans() {
  return useQuery({ queryKey: ['sa', 'plans'], queryFn: getSaPlans, staleTime: 60_000 });
}

export function useCreateSaPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSaPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'plans'] }),
  });
}

export function useUpdateSaPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSaPlan>[1] }) =>
      updateSaPlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'plans'] }),
  });
}

export function useDeleteSaPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSaPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'plans'] }),
  });
}

export function useSaBusinesses(status?: string) {
  return useQuery({
    queryKey: ['sa', 'businesses', status],
    queryFn: () => getSaBusinesses(status),
    staleTime: 30_000,
  });
}

export function useSaBusiness(id: string) {
  return useQuery({
    queryKey: ['sa', 'businesses', id],
    queryFn: () => getSaBusiness(id),
    staleTime: 30_000,
  });
}

export function useCreateSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBusinessPayload) => createSaBusiness(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'businesses'] }),
  });
}

export function useUpdateSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSaBusiness>[1] }) =>
      updateSaBusiness(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', vars.id] });
      qc.invalidateQueries({ queryKey: ['sa', 'businesses'] });
    },
  });
}

export function useSuspendSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: suspendSaBusiness,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', id] });
      qc.invalidateQueries({ queryKey: ['sa', 'businesses'] });
    },
  });
}

export function useActivateSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateSaBusiness,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', id] });
      qc.invalidateQueries({ queryKey: ['sa', 'businesses'] });
    },
  });
}

export function useUpsertSaSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertSubscriptionPayload) => upsertSaSubscription(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', vars.businessId] });
      qc.invalidateQueries({ queryKey: ['sa', 'dashboard'] });
    },
  });
}

export function useUpdateSaSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubscriptionPayload }) =>
      updateSaSubscription(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses'] });
      qc.invalidateQueries({ queryKey: ['sa', 'dashboard'] });
    },
  });
}
```

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/admin exec tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/admin/src/components/layout/super-sidebar.tsx \
  apps/admin/src/components/layout/super-shell.tsx \
  apps/admin/src/app/\(super\)/layout.tsx \
  apps/admin/src/middleware.ts \
  apps/admin/src/api/super-admin.ts \
  apps/admin/src/hooks/use-super-admin.ts
git commit -m "feat(admin): add Super Admin layout, middleware guard, API client, and hooks"
```

---

## Task 4: Admin — Dashboard page + components

**Files:**
- Create: `apps/admin/src/app/(super)/super/dashboard/components/sa-kpi-cards.tsx`
- Create: `apps/admin/src/app/(super)/super/dashboard/components/sa-plan-donut.tsx`
- Create: `apps/admin/src/app/(super)/super/dashboard/components/sa-new-biz-chart.tsx`
- Create: `apps/admin/src/app/(super)/super/dashboard/components/sa-biz-table.tsx`
- Create: `apps/admin/src/app/(super)/super/dashboard/page.tsx`

- [ ] **Step 1: Create KPI cards component**

Create `apps/admin/src/app/(super)/super/dashboard/components/sa-kpi-cards.tsx`:

```typescript
interface Props {
  mrr: number;
  activeBusinesses: number;
  trialBusinesses: number;
  totalOrders30d: number;
}

const fmtMxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export function SaKpiCards({ mrr, activeBusinesses, trialBusinesses, totalOrders30d }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-[#1A1A2E] rounded-xl p-4">
        <p className="text-2xl font-black text-white">{fmtMxn(mrr)}</p>
        <p className="text-xs text-white/50 mt-1">MRR</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-2xl font-black text-[#FF6B35]">{activeBusinesses}</p>
        <p className="text-xs text-gray-400 mt-1">Negocios activos</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-2xl font-black text-blue-500">{trialBusinesses}</p>
        <p className="text-xs text-gray-400 mt-1">En trial</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-2xl font-black text-gray-800">{totalOrders30d.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">Pedidos (30d)</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create plan donut chart**

Create `apps/admin/src/app/(super)/super/dashboard/components/sa-plan-donut.tsx`:

```typescript
import type { SaBizByPlan } from '@/api/super-admin';

const DONUT_COLORS: Record<string, string> = {
  Básico: '#9CA3AF',
  Pro: '#FF6B35',
  Plus: '#7C3AED',
};
const DEFAULT_COLOR = '#E5E7EB';

interface Props { data: SaBizByPlan[]; }

export function SaPlanDonut({ data }: Props) {
  const total = data.reduce((s, p) => s + p.count, 0);

  let cumulative = 0;
  const gradient =
    total === 0
      ? '#E5E7EB 0% 100%'
      : data
          .map((p) => {
            const pct = (p.count / total) * 100;
            const color = DONUT_COLORS[p.planName] ?? DEFAULT_COLOR;
            const seg = `${color} ${cumulative.toFixed(1)}% ${(cumulative + pct).toFixed(1)}%`;
            cumulative += pct;
            return seg;
          })
          .join(', ');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Negocios por plan
      </p>
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex-shrink-0"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="flex flex-col gap-1.5">
          {data.length === 0 ? (
            <p className="text-xs text-gray-400">Sin suscripciones</p>
          ) : (
            data.map((p) => (
              <div key={p.planName} className="flex items-center gap-2 text-xs text-gray-700">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: DONUT_COLORS[p.planName] ?? DEFAULT_COLOR }}
                />
                {p.planName} — {p.count}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create new-businesses bar chart**

Create `apps/admin/src/app/(super)/super/dashboard/components/sa-new-biz-chart.tsx`:

```typescript
import type { SaNewBiz } from '@/api/super-admin';

interface Props { data: SaNewBiz[]; }

export function SaNewBizChart({ data }: Props) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Nuevos negocios (30d)
      </p>
      <div className="flex items-end gap-0.5 h-10">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-[#FF6B35]/70"
            style={{
              height: d.count > 0 ? `${(d.count / maxCount) * 100}%` : '4px',
              opacity: d.count > 0 ? 0.8 : 0.2,
            }}
            title={`${d.date}: ${d.count}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-400">{data[0]?.date.slice(5) ?? ''}</span>
        <span className="text-[9px] text-gray-400">{data[14]?.date.slice(5) ?? ''}</span>
        <span className="text-[9px] text-gray-400">{data[29]?.date.slice(5) ?? ''}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create business table component**

Create `apps/admin/src/app/(super)/super/dashboard/components/sa-biz-table.tsx`:

```typescript
import Link from 'next/link';
import type { SaBusiness } from '@/api/super-admin';

const PLAN_BADGE: Record<string, { bg: string; text: string }> = {
  Básico: { bg: '#F3F4F6', text: '#6B7280' },
  Pro: { bg: '#FEF3C7', text: '#D97706' },
  Plus: { bg: '#EDE9FE', text: '#7C3AED' },
};
const DEFAULT_BADGE = PLAN_BADGE['Básico'];

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-green-600',
  TRIAL: 'text-blue-500',
  SUSPENDED: 'text-red-500',
  INACTIVE: 'text-gray-400',
};

interface Props { businesses: SaBusiness[]; }

export function SaBizTable({ businesses }: Props) {
  if (businesses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
        Sin negocios registrados
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-[1fr_100px_90px_90px] px-4 py-2 bg-gray-50 border-b border-gray-200">
        {['Negocio', 'Plan', 'Estado', 'Vence'].map((h) => (
          <span key={h} className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            {h}
          </span>
        ))}
      </div>
      {businesses.map((biz) => {
        const planName = biz.subscription?.plan?.name ?? null;
        const badge = planName ? (PLAN_BADGE[planName] ?? DEFAULT_BADGE) : DEFAULT_BADGE;
        const subStatus = biz.subscription?.status ?? biz.status;
        const endDate = biz.subscription?.endDate
          ? new Date(biz.subscription.endDate).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
            })
          : '—';
        return (
          <Link
            key={biz.id}
            href={`/super/negocios/${biz.id}`}
            className="grid grid-cols-[1fr_100px_90px_90px] px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
          >
            <div>
              <p className="text-sm font-bold text-gray-900">{biz.name}</p>
              <p className="text-[11px] text-gray-400">{biz.slug}</p>
            </div>
            <div>
              {planName ? (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {planName}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400">Sin plan</span>
              )}
            </div>
            <div className={`text-[11px] font-bold ${STATUS_COLOR[subStatus] ?? 'text-gray-400'}`}>
              {subStatus}
            </div>
            <div className="text-[11px] text-gray-500">{endDate}</div>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create dashboard page**

Create `apps/admin/src/app/(super)/super/dashboard/page.tsx`:

```typescript
'use client';

import { useSaBusinesses, useSaDashboard } from '@/hooks/use-super-admin';
import { SaBizTable } from './components/sa-biz-table';
import { SaKpiCards } from './components/sa-kpi-cards';
import { SaNewBizChart } from './components/sa-new-biz-chart';
import { SaPlanDonut } from './components/sa-plan-donut';

const EMPTY_DASHBOARD = {
  mrr: 0,
  activeBusinesses: 0,
  trialBusinesses: 0,
  totalOrders30d: 0,
  businessesByPlan: [],
  newBusinesses30d: [],
};

export default function SuperDashboardPage() {
  const { data: dashboard = EMPTY_DASHBOARD, isLoading: dashLoading } = useSaDashboard();
  const { data: businesses = [] } = useSaBusinesses();

  return (
    <div className="p-8 h-full overflow-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Dashboard SaaS</h1>

      {dashLoading ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <SaKpiCards
          mrr={dashboard.mrr}
          activeBusinesses={dashboard.activeBusinesses}
          trialBusinesses={dashboard.trialBusinesses}
          totalOrders30d={dashboard.totalOrders30d}
        />
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <SaPlanDonut data={dashboard.businessesByPlan} />
        <SaNewBizChart data={dashboard.newBusinesses30d} />
      </div>

      <SaBizTable businesses={businesses} />
    </div>
  );
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/admin exec tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/admin/src/app/\(super\)/super/dashboard/
git commit -m "feat(admin): add Super Admin dashboard page with KPI cards, charts, and business table"
```

---

## Task 5: Admin — Negocios pages

**Files:**
- Create: `apps/admin/src/app/(super)/super/negocios/page.tsx`
- Create: `apps/admin/src/app/(super)/super/negocios/nuevo/page.tsx`
- Create: `apps/admin/src/app/(super)/super/negocios/[id]/page.tsx`

- [ ] **Step 1: Create negocios list page**

Create `apps/admin/src/app/(super)/super/negocios/page.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSaBusinesses } from '@/hooks/use-super-admin';
import { SaBizTable } from '../dashboard/components/sa-biz-table';

type Filter = 'all' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Todos',
  ACTIVE: 'Activos',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspendidos',
};

export default function SuperNegociosPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const { data: businesses = [], isLoading } = useSaBusinesses(
    filter === 'all' ? undefined : filter,
  );

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Negocios</h1>
        <Link
          href="/super/negocios/nuevo"
          className="bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e55a2b] transition-colors"
        >
          + Nuevo negocio
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1 rounded-full font-medium transition-colors ${
              filter === f
                ? 'bg-[#1A1A2E] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          Cargando...
        </div>
      ) : (
        <SaBizTable businesses={businesses} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create nuevo negocio page**

Create `apps/admin/src/app/(super)/super/negocios/nuevo/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateSaBusiness } from '@/hooks/use-super-admin';

const FIELDS = [
  { label: 'Nombre del negocio', key: 'businessName', type: 'text' },
  { label: 'Slug (URL)', key: 'slug', type: 'text' },
  { label: 'Teléfono', key: 'phone', type: 'tel' },
  { label: 'Nombre del owner', key: 'ownerName', type: 'text' },
  { label: 'Email del owner', key: 'ownerEmail', type: 'email' },
  { label: 'Contraseña del owner', key: 'ownerPassword', type: 'password' },
] as const;

type FormKey = (typeof FIELDS)[number]['key'];
type FormState = Record<FormKey, string>;

const EMPTY_FORM: FormState = {
  businessName: '',
  slug: '',
  phone: '',
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
};

export default function NuevoNegocioPage() {
  const router = useRouter();
  const { mutateAsync, isPending, error } = useCreateSaBusiness();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const set = (key: FormKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await mutateAsync(form);
    router.push(`/super/negocios/${res.business.id}`);
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Nuevo negocio</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {FIELDS.map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={set(key)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
          </div>
        ))}
        {error && (
          <p className="text-sm text-red-500">
            {(error as any)?.response?.data?.message ?? 'Error al crear negocio'}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-[#FF6B35] text-white rounded-lg py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50"
          >
            {isPending ? 'Creando...' : 'Crear negocio'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create business detail page**

Create `apps/admin/src/app/(super)/super/negocios/[id]/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useActivateSaBusiness,
  useSaBusiness,
  useSaPlans,
  useSuspendSaBusiness,
  useUpdateSaBusiness,
  useUpsertSaSubscription,
} from '@/hooks/use-super-admin';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  INACTIVE: 'Inactivo',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-red-100 text-red-600',
  INACTIVE: 'bg-gray-100 text-gray-500',
};

const inputClass =
  'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]';

export default function NegocioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: biz, isLoading } = useSaBusiness(id);
  const { data: plans = [] } = useSaPlans();
  const updateBiz = useUpdateSaBusiness();
  const suspend = useSuspendSaBusiness();
  const activate = useActivateSaBusiness();
  const upsertSub = useUpsertSaSubscription();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  const [subPlanId, setSubPlanId] = useState('');
  const [subStartDate, setSubStartDate] = useState('');
  const [subEndDate, setSubEndDate] = useState('');
  const [subStatus, setSubStatus] = useState<'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'>(
    'TRIAL',
  );

  const handleStartEdit = () => {
    if (!biz) return;
    setEditName(biz.name);
    setEditPhone(biz.phone);
    setEditWhatsapp(biz.whatsapp ?? '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    await updateBiz.mutateAsync({
      id,
      data: { name: editName, phone: editPhone, whatsapp: editWhatsapp || undefined },
    });
    setIsEditing(false);
  };

  const handleUpsertSub = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertSub.mutateAsync({
      businessId: id,
      planId: subPlanId,
      startDate: subStartDate,
      endDate: subEndDate || undefined,
      status: subStatus,
    });
  };

  if (isLoading || !biz) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  }

  return (
    <div className="p-8 max-w-2xl space-y-8">
      {/* Section 1: Business info */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-black text-gray-900">{biz.name}</h1>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${
              STATUS_BADGE[biz.status] ?? STATUS_BADGE.INACTIVE
            }`}
          >
            {STATUS_LABEL[biz.status] ?? biz.status}
          </span>
        </div>

        {!isEditing ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium text-gray-500 w-24 inline-block">Slug:</span>
              {biz.slug}
            </p>
            <p className="text-sm">
              <span className="font-medium text-gray-500 w-24 inline-block">Teléfono:</span>
              {biz.phone}
            </p>
            <p className="text-sm">
              <span className="font-medium text-gray-500 w-24 inline-block">WhatsApp:</span>
              {biz.whatsapp ?? '—'}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleStartEdit}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Editar
              </button>
              {biz.status !== 'SUSPENDED' ? (
                <button
                  onClick={() => {
                    if (confirm('¿Suspender este negocio?')) suspend.mutate(id);
                  }}
                  disabled={suspend.isPending}
                  className="text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-50"
                >
                  Suspender
                </button>
              ) : (
                <button
                  onClick={() => activate.mutate(id)}
                  disabled={activate.isPending}
                  className="text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 disabled:opacity-50"
                >
                  Activar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            {[
              { label: 'Nombre', value: editName, onChange: (v: string) => setEditName(v) },
              { label: 'Teléfono', value: editPhone, onChange: (v: string) => setEditPhone(v) },
              { label: 'WhatsApp', value: editWhatsapp, onChange: (v: string) => setEditWhatsapp(v) },
            ].map(({ label, value, onChange }) => (
              <div key={label}>
                <label className="text-xs font-medium text-gray-500">{label}</label>
                <input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateBiz.isPending}
                className="text-sm bg-[#FF6B35] text-white rounded-lg px-3 py-1.5 hover:bg-[#e55a2b] disabled:opacity-50"
              >
                {updateBiz.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Subscription */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Suscripción</h2>

        {biz.subscription && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 text-sm space-y-1">
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Plan:</span>
              {biz.subscription.plan?.name ?? '—'}
            </p>
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Estado:</span>
              {biz.subscription.status}
            </p>
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Inicio:</span>
              {new Date(biz.subscription.startDate).toLocaleDateString('es-MX')}
            </p>
            <p>
              <span className="font-medium text-gray-500 w-20 inline-block">Vence:</span>
              {biz.subscription.endDate
                ? new Date(biz.subscription.endDate).toLocaleDateString('es-MX')
                : '—'}
            </p>
          </div>
        )}

        <form
          onSubmit={handleUpsertSub}
          className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {biz.subscription ? 'Actualizar suscripción' : 'Asignar suscripción'}
          </p>
          <div>
            <label className="text-xs font-medium text-gray-500">Plan</label>
            <select
              value={subPlanId}
              onChange={(e) => setSubPlanId(e.target.value)}
              required
              className={`${inputClass} mt-1`}
            >
              <option value="">Selecciona un plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${p.monthlyPrice}/mes
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Fecha inicio</label>
              <input
                type="date"
                value={subStartDate}
                onChange={(e) => setSubStartDate(e.target.value)}
                required
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Fecha vencimiento</label>
              <input
                type="date"
                value={subEndDate}
                onChange={(e) => setSubEndDate(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Estado</label>
            <select
              value={subStatus}
              onChange={(e) =>
                setSubStatus(e.target.value as typeof subStatus)
              }
              className={`${inputClass} mt-1`}
            >
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Activo</option>
              <option value="SUSPENDED">Suspendido</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={upsertSub.isPending}
            className="w-full bg-[#FF6B35] text-white rounded-lg py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50"
          >
            {upsertSub.isPending
              ? 'Guardando...'
              : biz.subscription
              ? 'Actualizar'
              : 'Asignar'}
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/admin exec tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/admin/src/app/\(super\)/super/negocios/
git commit -m "feat(admin): add Super Admin negocios pages (list, create, detail + subscription)"
```

---

## Task 6: Admin — Planes page

**Files:**
- Create: `apps/admin/src/app/(super)/super/planes/page.tsx`

- [ ] **Step 1: Create planes page**

Create `apps/admin/src/app/(super)/super/planes/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import {
  useCreateSaPlan,
  useDeleteSaPlan,
  useSaPlans,
  useUpdateSaPlan,
} from '@/hooks/use-super-admin';
import type { SaPlan } from '@/api/super-admin';

type EditRow = Omit<SaPlan, 'id'>;
const EMPTY_ROW: EditRow = { name: '', monthlyPrice: 0, maxUsers: 1, maxProducts: 1, maxBranches: 1 };

const inputClass =
  'border border-gray-200 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#FF6B35]';

export default function PlanesPage() {
  const { data: plans = [], isLoading } = useSaPlans();
  const create = useCreateSaPlan();
  const update = useUpdateSaPlan();
  const del = useDeleteSaPlan();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow>(EMPTY_ROW);
  const [isCreating, setIsCreating] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>(EMPTY_ROW);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEdit = (plan: SaPlan) => {
    setEditingId(plan.id);
    setEditRow({
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      maxUsers: plan.maxUsers,
      maxProducts: plan.maxProducts,
      maxBranches: plan.maxBranches,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await update.mutateAsync({ id: editingId, data: editRow });
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(newRow);
    setIsCreating(false);
    setNewRow(EMPTY_ROW);
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    try {
      await del.mutateAsync(id);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message ?? 'No se puede eliminar este plan');
    }
  };

  const setEdit =
    <K extends keyof EditRow>(setter: React.Dispatch<React.SetStateAction<EditRow>>) =>
    (key: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setter((r) => ({ ...r, [key]: key === 'name' ? e.target.value : Number(e.target.value) }));

  const COLS = 'grid-cols-[160px_90px_70px_90px_90px_110px]';

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Planes</h1>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e55a2b]"
          >
            + Nuevo plan
          </button>
        )}
      </div>

      {deleteError && (
        <p className="text-sm text-red-500 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`grid ${COLS} px-4 py-2 bg-gray-50 border-b border-gray-200`}>
          {['Nombre', 'Precio/mes', 'Usuarios', 'Productos', 'Branches', ''].map((h) => (
            <span key={h} className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
              {h}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-gray-400 text-center">Cargando...</div>
        ) : (
          <>
            {plans.map((plan) =>
              editingId === plan.id ? (
                <div
                  key={plan.id}
                  className={`grid ${COLS} px-4 py-2 gap-1 items-center border-b border-gray-100`}
                >
                  <input value={editRow.name} onChange={setEdit(setEditRow)('name')} className={inputClass} />
                  <input type="number" value={editRow.monthlyPrice} onChange={setEdit(setEditRow)('monthlyPrice')} className={inputClass} />
                  <input type="number" value={editRow.maxUsers} onChange={setEdit(setEditRow)('maxUsers')} min={1} className={inputClass} />
                  <input type="number" value={editRow.maxProducts} onChange={setEdit(setEditRow)('maxProducts')} min={1} className={inputClass} />
                  <input type="number" value={editRow.maxBranches} onChange={setEdit(setEditRow)('maxBranches')} min={1} className={inputClass} />
                  <div className="flex gap-1">
                    <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✕</button>
                    <button onClick={handleSaveEdit} disabled={update.isPending} className="text-xs px-2 py-1 bg-[#FF6B35] text-white rounded hover:bg-[#e55a2b] disabled:opacity-50">✓</button>
                  </div>
                </div>
              ) : (
                <div
                  key={plan.id}
                  className={`grid ${COLS} px-4 py-3 items-center border-b border-gray-100 last:border-0`}
                >
                  <span className="text-sm font-bold text-gray-800">{plan.name}</span>
                  <span className="text-sm text-gray-700">${plan.monthlyPrice}</span>
                  <span className="text-sm text-gray-600">{plan.maxUsers}</span>
                  <span className="text-sm text-gray-600">{plan.maxProducts}</span>
                  <span className="text-sm text-gray-600">{plan.maxBranches}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(plan)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">Editar</button>
                    <button onClick={() => handleDelete(plan.id)} disabled={del.isPending} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">Eliminar</button>
                  </div>
                </div>
              ),
            )}

            {isCreating && (
              <form
                onSubmit={handleCreate}
                className={`grid ${COLS} px-4 py-2 gap-1 items-center border-t border-[#FF6B35]/30`}
              >
                <input placeholder="Nombre" value={newRow.name} onChange={setEdit(setNewRow)('name')} required className={inputClass} />
                <input type="number" placeholder="Precio" value={newRow.monthlyPrice || ''} onChange={setEdit(setNewRow)('monthlyPrice')} required min={0} className={inputClass} />
                <input type="number" placeholder="Users" value={newRow.maxUsers || ''} onChange={setEdit(setNewRow)('maxUsers')} required min={1} className={inputClass} />
                <input type="number" placeholder="Prods" value={newRow.maxProducts || ''} onChange={setEdit(setNewRow)('maxProducts')} required min={1} className={inputClass} />
                <input type="number" placeholder="Branch" value={newRow.maxBranches || ''} onChange={setEdit(setNewRow)('maxBranches')} required min={1} className={inputClass} />
                <div className="flex gap-1">
                  <button type="button" onClick={() => { setIsCreating(false); setNewRow(EMPTY_ROW); }} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">✕</button>
                  <button type="submit" disabled={create.isPending} className="text-xs px-2 py-1 bg-[#FF6B35] text-white rounded hover:bg-[#e55a2b] disabled:opacity-50">✓</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/admin exec tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/admin/src/app/\(super\)/super/planes/
git commit -m "feat(admin): add Super Admin planes page with inline CRUD"
```

---

## Task 7: Final check + tag v1.0.0

- [ ] **Step 1: Run super-admin integration tests**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
NODE_OPTIONS=--experimental-vm-modules pnpm --filter @pidefacil/api test --testPathPattern="super-admin.integration" --runInBand 2>&1 | tail -20
```

Expected: 17 tests pass.

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
NODE_OPTIONS=--experimental-vm-modules pnpm --filter @pidefacil/api test --runInBand 2>&1 | tail -20
```

Expected: same baseline as before Phase 8 + 17 new passing. Only the 2 pre-existing MinIO failures expected.

- [ ] **Step 3: TypeScript check all 3 apps**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/api exec tsc --noEmit 2>&1 | head -10 && echo "API: OK"
pnpm --filter @pidefacil/admin exec tsc --noEmit 2>&1 | head -10 && echo "ADMIN: OK"
pnpm --filter @pidefacil/mobile exec tsc --noEmit 2>&1 | head -10 && echo "MOBILE: OK"
```

Expected: each prints "OK".

- [ ] **Step 4: Tag v1.0.0**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git tag v1.0.0
git log --oneline -5
```

Expected: tag `v1.0.0` appears on the latest commit.
