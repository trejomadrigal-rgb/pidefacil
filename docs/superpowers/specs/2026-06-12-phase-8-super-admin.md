# Phase 8 — Super Admin Design Spec

## Overview

Phase 8 adds a Super Admin area to PideFacil. It allows the platform operator (SUPER_ADMIN) to manage all businesses, pricing plans, and subscriptions from a single panel — with a SaaS metrics dashboard to track MRR, active businesses, and platform health.

**Goal:** Let the platform operator onboard new businesses, assign plans, manage trial/active/suspended states, and monitor revenue — all from a dedicated admin section.

**Billing model:** Manual. The Super Admin assigns plans and records payment state offline. No Stripe/Conekta integration.

---

## Decisions Made

| Question | Decision |
|---|---|
| Billing | Manual — no payment processor |
| Features in scope | Dashboard + Plans CRUD + Businesses CRUD + Subscriptions |
| API structure | Single `SuperAdminModule` at `/super-admin/*` |
| Admin UI | Dedicated `/super/*` section with its own layout in `apps/admin` |
| Dashboard layout | A — KPIs + charts + business table |
| Subscriptions page | No separate page — managed from business detail |

---

## Existing Schema (already in Prisma, no migrations needed)

```prisma
model Plan {
  id            String         @id @default(cuid())
  name          String         @unique
  monthlyPrice  Decimal
  maxUsers      Int
  maxProducts   Int
  maxBranches   Int
  subscriptions Subscription[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model Subscription {
  id         String             @id @default(cuid())
  businessId String             @unique
  planId     String
  startDate  DateTime
  endDate    DateTime?
  status     SubscriptionStatus
  business   Business           @relation(fields: [businessId], references: [id])
  plan       Plan               @relation(fields: [planId], references: [id])
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}
```

`Business.status` already has `ACTIVE | SUSPENDED | INACTIVE`. The `SUPER_ADMIN` role already exists in the `Role` enum.

---

## API — `SuperAdminModule`

All endpoints require `Authorization: Bearer <jwt>` with `role = SUPER_ADMIN`.  
Base path: `/super-admin`

### Dashboard

```
GET /super-admin/dashboard
```

**Response:**
```typescript
interface SuperAdminDashboardDto {
  mrr: number;                         // sum of monthlyPrice where subscription.status = ACTIVE
  activeBusinesses: number;            // count where status = ACTIVE
  trialBusinesses: number;             // count where subscription.status = TRIAL
  totalOrders30d: number;              // orders created in last 30 days across all businesses
  businessesByPlan: Array<{
    planName: string;
    count: number;
  }>;
  newBusinesses30d: Array<{
    date: string;                      // YYYY-MM-DD
    count: number;
  }>;
}
```

**Implementation notes:**
- MRR: JOIN subscription → plan WHERE subscription.status = 'ACTIVE', SUM monthlyPrice. `Plan.monthlyPrice` is a Prisma `Decimal` — call `.toNumber()` when building the response.
- `businessesByPlan`: groupBy subscription.planId, include plan.name
- `newBusinesses30d`: use `prisma.business.findMany({ where: { createdAt: { gte: thirtyDaysAgo } } })` then bucket by `createdAt.toISOString().slice(0,10)` into a 30-entry array (one entry per day, zero-filled for days with no new businesses). Same JS-bucketing pattern as `peakHours` in ReportsModule.

### Plans

```
GET    /super-admin/plans
POST   /super-admin/plans
PATCH  /super-admin/plans/:id
DELETE /super-admin/plans/:id     → 409 if any ACTIVE or TRIAL subscription references this plan
```

**CreatePlanDto / UpdatePlanDto:**
```typescript
class CreatePlanDto {
  @IsString() @IsNotEmpty() name: string;
  @IsNumber() @Min(0) monthlyPrice: number;
  @IsInt() @Min(1) maxUsers: number;
  @IsInt() @Min(1) maxProducts: number;
  @IsInt() @Min(1) maxBranches: number;
}
```

### Businesses

```
GET    /super-admin/businesses          ?status=ACTIVE|SUSPENDED|INACTIVE  (optional)
POST   /super-admin/businesses          (replaces existing POST /business/admin/businesses in BusinessModule)
GET    /super-admin/businesses/:id
PATCH  /super-admin/businesses/:id
POST   /super-admin/businesses/:id/suspend    → sets business.status = SUSPENDED
POST   /super-admin/businesses/:id/activate   → sets business.status = ACTIVE
```

`GET /super-admin/businesses` returns: `id, name, slug, status, subscription { status, endDate, plan { name } }, createdAt`

`GET /super-admin/businesses/:id` returns full business + subscription + plan.

**Breaking change:** The existing `POST /business/admin/businesses` endpoint in `BusinessModule` is removed and replaced by `POST /super-admin/businesses`. The integration spec for that endpoint must be updated to point to the new route.

### Subscriptions

```
POST   /super-admin/subscriptions       → creates or replaces subscription for a business
PATCH  /super-admin/subscriptions/:id   → update plan, dates, or status
```

**CreateSubscriptionDto:**
```typescript
class CreateSubscriptionDto {
  @IsString() @IsNotEmpty() businessId: string;
  @IsString() @IsNotEmpty() planId: string;
  @IsDateString() startDate: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsEnum(SubscriptionStatus) status: SubscriptionStatus;
}
```

`POST /super-admin/subscriptions` upserts — if a subscription already exists for `businessId`, it updates it. This allows plan changes via the same endpoint.

---

## Admin UI — `apps/admin`

### Route structure

New route group `(super)` alongside the existing `(admin)` group:

```
apps/admin/src/app/
├── (admin)/              ← existing business admin routes
│   └── layout.tsx        ← existing sidebar
├── (super)/              ← new super admin routes
│   ├── layout.tsx        ← new super admin layout + sidebar
│   ├── super/
│   │   ├── dashboard/page.tsx
│   │   ├── negocios/
│   │   │   ├── page.tsx
│   │   │   ├── nuevo/page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── planes/page.tsx
```

### Layout — `(super)/layout.tsx`

Server component. Reads JWT from cookies via `cookies()` from `next/headers` (same pattern as `(admin)/layout.tsx`). If `role !== SUPER_ADMIN` redirect to `/dashboard`. Renders a dark sidebar with 3 links: Dashboard / Negocios / Planes. Completely independent of the `(admin)` layout.

### Middleware redirect

In `apps/admin/src/middleware.ts`, after JWT decode: if `role === SUPER_ADMIN` and path starts with `/dashboard` → redirect to `/super/dashboard`.

### Pages

**`/super/dashboard`** — `'use client'`
- Calls `GET /super-admin/dashboard` via TanStack Query (`staleTime: 60_000`)
- 4 KPI cards: MRR (orange accent), Negocios activos, En trial, Pedidos 30d
- 2 CSS-only charts (no recharts, same approach as Phase 7): donut via `conic-gradient` (negocios por plan, colors from plan badge map), vertical bars (nuevos negocios 30d, 30 bars zero-filled)
- Business table: name + slug, plan badge, status, subscription endDate — links to `/super/negocios/[id]`
- No date filter — always shows current state + rolling 30d

**`/super/negocios`** — `'use client'`
- Table of all businesses with status filter chips (Todos / Activos / Trial / Suspendidos)
- "Nuevo negocio" button → `/super/negocios/nuevo`
- Each row links to `/super/negocios/[id]`

**`/super/negocios/nuevo`** — `'use client'`
- Form: name, slug, phone, whatsapp, timezone (default: `America/Mexico_City`)
- On submit: `POST /super-admin/businesses` → redirect to the new business detail

**`/super/negocios/[id]`** — `'use client'`
- **Section 1 — Business info:** name, slug, phone, whatsapp, status badge. Edit form (PATCH). Suspend/Activate buttons (with confirmation dialog).
- **Section 2 — Subscription:** current plan name + status + dates. Form to assign/update: plan selector (from `GET /super-admin/plans`), startDate, endDate, status selector. Calls `POST /super-admin/subscriptions` (upsert).

**`/super/planes`** — `'use client'`
- Table of all plans: name, monthlyPrice, maxUsers, maxProducts, maxBranches
- Each row has an Edit button → inline form row (not a modal)
- "Nuevo plan" button → appends a new inline form row at the bottom
- Delete button disabled if plan has active subscriptions (API returns 409, shown as toast error)

### API client layer

```
apps/admin/src/api/super-admin.ts    ← all fetch functions (dashboard, plans, businesses, subscriptions)
apps/admin/src/hooks/use-super-admin.ts   ← TanStack Query hooks
```

### Plan badges (color map)

| Plan name | Background | Text |
|---|---|---|
| Básico | `#F3F4F6` | `#6B7280` |
| Pro | `#FEF3C7` | `#D97706` |
| Plus | `#EDE9FE` | `#7C3AED` |

Dynamic: color is looked up by plan name, defaulting to Básico colors for unknown plans.

---

## Integration Tests

**`super-admin.integration.spec.ts`** — one file covering all super-admin endpoints:

1. `GET /super-admin/dashboard` — 401 unauthenticated, 403 for OWNER, returns zeros on empty, MRR sums only ACTIVE subscriptions, trial count correct
2. `GET /super-admin/plans` — returns all plans
3. `POST /super-admin/plans` — creates plan, 403 for OWNER
4. `PATCH /super-admin/plans/:id` — updates price
5. `DELETE /super-admin/plans/:id` — 409 when active subscription exists
6. `GET /super-admin/businesses` — returns all businesses, status filter works
7. `POST /super-admin/businesses` — creates business
8. `POST /super-admin/businesses/:id/suspend` — sets status SUSPENDED
9. `POST /super-admin/businesses/:id/activate` — sets status ACTIVE
10. `POST /super-admin/subscriptions` — creates subscription, upsert replaces existing
11. `PATCH /super-admin/subscriptions/:id` — updates plan and dates
12. Existing `POST /business/admin/businesses` → 404 (endpoint removed)

---

## Out of Scope (Phase 8)

- Payment processing (Stripe/Conekta)
- Email notifications to businesses on suspension
- Audit log UI (model exists in schema but no UI)
- Per-business cross-tenant reports (SA can see platform-wide totals only)
- Branch management
- Super admin password management UI
