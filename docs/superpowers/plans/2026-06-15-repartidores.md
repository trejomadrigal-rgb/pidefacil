# Repartidores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the delivery driver (repartidor) management system — turns, trip-based liquidations, delivery order flow, transfer payment confirmation, and real-time chat between driver and customer.

**Architecture:** New `shifts` and `delivery` NestJS modules added to the existing API; `Liquidation` model refactored from a simple settlement record into a per-trip model with shift relationship; existing `(tabs)` mobile navigation extended with a parallel `(delivery)` route group for the DELIVERY role; Firebase Realtime Database (via existing `firebase-admin`) manages ephemeral chat rooms keyed by orderId.

**Tech Stack:** NestJS (API), Next.js (admin panel + web QR), Expo Router (mobile), Prisma (schema), Firebase Admin SDK (RTDB), Firebase JS SDK (mobile + web client chat), shadcn/ui (admin panel), NativeWind (mobile)

---

## Phase 1 — Schema & API (Tasks 1–3)

Everything else depends on these tasks.

---

### Task 1: Prisma Schema Refactor

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `DELIVERY` to the `Role` enum**

```prisma
enum Role {
  SUPER_ADMIN
  OWNER
  ADMIN
  OPERATOR
  KITCHEN
  MENU_DESIGNER
  DELIVERY
}
```

- [ ] **Step 2: Add `ShiftStatus`, `LiquidationStatus` enums and update `NotificationType`**

```prisma
enum ShiftStatus {
  OPEN
  CLOSED
}

enum LiquidationStatus {
  OPEN
  CLOSED
}

enum NotificationType {
  NEW_PREORDER
  ORDER_READY
  ORDER_CANCELLED
  DELIVERY_RETURN
}
```

- [ ] **Step 3: Add `assignedToId`, `liquidationId`, `transferConfirmed` to `Order`**

Inside the `Order` model add these fields after `isPaid`:

```prisma
  assignedToId      String?
  liquidationId     String?
  transferConfirmed Boolean  @default(false)
```

Add the relations at the bottom of the model (after `payment  Payment?`):

```prisma
  assignedTo  User?        @relation("OrdersAssigned", fields: [assignedToId], references: [id])
  liquidation Liquidation? @relation(fields: [liquidationId], references: [id])
```

Add indexes:

```prisma
  @@index([assignedToId])
  @@index([liquidationId])
```

- [ ] **Step 4: Add `Shift` model (before `Liquidation`)**

```prisma
model Shift {
  id             String      @id @default(cuid())
  businessId     String
  branchId       String?
  deliveryUserId String
  openedById     String
  closedById     String?
  status         ShiftStatus @default(OPEN)
  openedAt       DateTime    @default(now())
  closedAt       DateTime?
  notes          String?

  business     Business      @relation(fields: [businessId], references: [id])
  branch       Branch?       @relation(fields: [branchId], references: [id])
  deliveryUser User          @relation("ShiftDeliveryUser", fields: [deliveryUserId], references: [id])
  openedBy     User          @relation("ShiftOpenedBy", fields: [openedById], references: [id])
  closedBy     User?         @relation("ShiftClosedBy", fields: [closedById], references: [id])
  liquidations Liquidation[]

  @@index([businessId])
  @@index([businessId, status])
}
```

- [ ] **Step 5: Replace the `Liquidation` model entirely**

Remove the existing `Liquidation` model and replace with:

```prisma
model Liquidation {
  id            String            @id @default(cuid())
  businessId    String
  shiftId       String
  status        LiquidationStatus @default(OPEN)
  createdAt     DateTime          @default(now())
  closedAt      DateTime?
  confirmedById String?
  cashTotal     Decimal           @default(0) @db.Decimal(10, 2)
  cardTotal     Decimal           @default(0) @db.Decimal(10, 2)
  transferTotal Decimal           @default(0) @db.Decimal(10, 2)
  notes         String?

  business    Business @relation(fields: [businessId], references: [id])
  shift       Shift    @relation(fields: [shiftId], references: [id])
  confirmedBy User?    @relation("LiquidationConfirmedBy", fields: [confirmedById], references: [id])
  orders      Order[]

  @@index([businessId])
  @@index([shiftId])
}
```

- [ ] **Step 6: Update `User`, `Business`, `Branch` relations for new models**

In the `User` model, remove the old liquidation relations and add:

```prisma
  // Remove these two lines:
  // deliveryLiquidations Liquidation[]  @relation("DeliveryLiquidations")
  // receivedLiquidations Liquidation[]  @relation("ReceivedLiquidations")

  // Add these:
  confirmedLiquidations Liquidation[] @relation("LiquidationConfirmedBy")
  deliveryShifts        Shift[]       @relation("ShiftDeliveryUser")
  openedShifts          Shift[]       @relation("ShiftOpenedBy")
  closedShifts          Shift[]       @relation("ShiftClosedBy")
  assignedOrders        Order[]       @relation("OrdersAssigned")
```

In `Business` model, add `shifts Shift[]` to the relations list.
In `Branch` model, add `shifts Shift[]` to the relations list.

- [ ] **Step 7: Generate and run the migration**

```bash
cd apps/api
npx prisma migrate dev --name add-repartidores-schema
```

Expected: Migration created and applied. Verify with:

```bash
npx prisma studio
```

Open browser at `http://localhost:5555`, confirm `Shift` and updated `Liquidation` tables exist.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): add repartidores — Shift, DELIVERY role, per-trip Liquidation, Order delivery fields"
```

---

### Task 2: Shifts API Module

**Files:**
- Create: `apps/api/src/shifts/shifts.module.ts`
- Create: `apps/api/src/shifts/shifts.service.ts`
- Create: `apps/api/src/shifts/shifts.admin.controller.ts`
- Create: `apps/api/src/shifts/dto/create-shift.dto.ts`
- Create: `apps/api/src/shifts/dto/create-liquidation-trip.dto.ts`
- Create: `apps/api/src/shifts/shifts.integration.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/src/shifts/shifts.integration.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('ShiftsModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let deliveryUserId: string;
  let shiftId: string;
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

    const biz = await prisma.business.create({
      data: { name: 'Fonda Turnos', slug: `shifts-test-${suffix}`, phone: '5551112233' },
    });
    businessId = biz.id;

    // Create owner
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Test1234!', 10);
    const owner = await prisma.user.create({
      data: { businessId, name: 'Owner', email: `owner-shifts-${suffix}@test.com`, passwordHash: hash, role: 'OWNER' },
    });

    // Create delivery user
    const delivery = await prisma.user.create({
      data: { businessId, name: 'Repartidor Juan', email: `delivery-${suffix}@test.com`, passwordHash: hash, role: 'DELIVERY' },
    });
    deliveryUserId = delivery.id;

    // Login owner
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `owner-shifts-${suffix}@test.com`, password: 'Test1234!' });
    ownerToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await prisma.shift.deleteMany({ where: { businessId } });
    await prisma.user.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await app.close();
  });

  it('POST /shifts — creates a shift', async () => {
    const res = await request(app.getHttpServer())
      .post('/shifts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deliveryUserId });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.deliveryUserId).toBe(deliveryUserId);
    shiftId = res.body.id;
  });

  it('GET /shifts — lists shifts for business', async () => {
    const res = await request(app.getHttpServer())
      .get('/shifts')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((s: { id: string }) => s.id === shiftId)).toBe(true);
  });

  it('PATCH /shifts/:id/close — closes the shift', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLOSED');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api
npx jest shifts.integration --runInBand --forceExit
```

Expected: FAIL — cannot find module, controller not found.

- [ ] **Step 3: Create DTOs**

`apps/api/src/shifts/dto/create-shift.dto.ts`:

```typescript
import { IsString, IsOptional } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  deliveryUserId: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
```

`apps/api/src/shifts/dto/create-liquidation-trip.dto.ts`:

```typescript
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class CreateLiquidationTripDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
```

Add `@IsOptional()` import to the second DTO as well.

- [ ] **Step 4: Create the service**

`apps/api/src/shifts/shifts.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateLiquidationTripDto } from './dto/create-liquidation-trip.dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, openedById: string, dto: CreateShiftDto) {
    const deliveryUser = await this.prisma.user.findFirst({
      where: { id: dto.deliveryUserId, businessId, role: 'DELIVERY' },
    });
    if (!deliveryUser) throw new NotFoundException('Repartidor no encontrado');

    const openShift = await this.prisma.shift.findFirst({
      where: { businessId, deliveryUserId: dto.deliveryUserId, status: 'OPEN' },
    });
    if (openShift) throw new BadRequestException('Este repartidor ya tiene un turno abierto');

    return this.prisma.shift.create({
      data: {
        businessId,
        deliveryUserId: dto.deliveryUserId,
        openedById,
        branchId: dto.branchId,
        notes: dto.notes,
      },
      include: {
        deliveryUser: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        liquidations: true,
      },
    });
  }

  async findAll(businessId: string) {
    return this.prisma.shift.findMany({
      where: { businessId },
      include: {
        deliveryUser: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        liquidations: {
          include: {
            orders: { select: { id: true, orderNumber: true, status: true, total: true, paymentMethod: true } },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findOne(id: string, businessId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, businessId },
      include: {
        deliveryUser: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        liquidations: {
          include: {
            orders: {
              select: {
                id: true, orderNumber: true, status: true, total: true,
                paymentMethod: true, customerName: true, deliveryAddress: true,
              },
            },
            confirmedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    return shift;
  }

  async close(id: string, businessId: string, closedById: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id, businessId } });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    if (shift.status === 'CLOSED') throw new BadRequestException('El turno ya está cerrado');

    const openTrips = await this.prisma.liquidation.count({
      where: { shiftId: id, status: 'OPEN' },
    });
    if (openTrips > 0) throw new BadRequestException('Hay salidas sin liquidar en este turno');

    return this.prisma.shift.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedById },
    });
  }

  async createTrip(shiftId: string, businessId: string, dto: CreateLiquidationTripDto) {
    const shift = await this.prisma.shift.findFirst({ where: { id: shiftId, businessId, status: 'OPEN' } });
    if (!shift) throw new NotFoundException('Turno no encontrado o ya cerrado');

    // Validate all orders belong to business, are READY, and not already in a trip
    const orders = await this.prisma.order.findMany({
      where: { id: { in: dto.orderIds }, businessId, status: 'READY' },
    });
    if (orders.length !== dto.orderIds.length) {
      throw new BadRequestException('Algunos pedidos no están en estado READY o no pertenecen al negocio');
    }

    const alreadyAssigned = orders.filter((o) => o.liquidationId !== null);
    if (alreadyAssigned.length > 0) {
      throw new BadRequestException('Algunos pedidos ya están asignados a una salida');
    }

    const nonTransferOrders = orders.filter((o) => o.paymentMethod !== 'TRANSFER');
    const transferNotConfirmed = orders.filter(
      (o) => o.paymentMethod === 'TRANSFER' && !o.transferConfirmed,
    );
    if (transferNotConfirmed.length > 0) {
      throw new BadRequestException('Hay pedidos con transferencia pendiente de confirmar');
    }

    return this.prisma.$transaction(async (tx) => {
      const trip = await tx.liquidation.create({
        data: {
          businessId,
          shiftId,
          notes: dto.notes,
        },
      });

      await tx.order.updateMany({
        where: { id: { in: dto.orderIds } },
        data: {
          liquidationId: trip.id,
          assignedToId: shift.deliveryUserId,
        },
      });

      return tx.liquidation.findUnique({
        where: { id: trip.id },
        include: {
          orders: { select: { id: true, orderNumber: true, status: true, total: true, paymentMethod: true, customerName: true } },
        },
      });
    });
  }

  async closeTrip(tripId: string, businessId: string, confirmedById: string) {
    const trip = await this.prisma.liquidation.findFirst({
      where: { id: tripId, businessId },
      include: { orders: true },
    });
    if (!trip) throw new NotFoundException('Salida no encontrada');
    if (trip.status === 'CLOSED') throw new BadRequestException('Esta salida ya está liquidada');

    const cashTotal = trip.orders
      .filter((o) => o.paymentMethod === 'CASH' && o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const cardTotal = trip.orders
      .filter((o) => o.paymentMethod === 'CARD' && o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const transferTotal = trip.orders
      .filter((o) => o.paymentMethod === 'TRANSFER' && o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.total), 0);

    return this.prisma.liquidation.update({
      where: { id: tripId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        confirmedById,
        cashTotal,
        cardTotal,
        transferTotal,
      },
    });
  }
}
```

- [ ] **Step 5: Create the admin controller**

`apps/api/src/shifts/shifts.admin.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateLiquidationTripDto } from './dto/create-liquidation-trip.dto';

@Controller('shifts')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class ShiftsAdminController {
  constructor(private shifts: ShiftsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateShiftDto) {
    return this.shifts.create(user.businessId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.shifts.findAll(user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.shifts.findOne(id, user.businessId);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.shifts.close(id, user.businessId, user.userId);
  }

  @Post(':id/trips')
  createTrip(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLiquidationTripDto,
  ) {
    return this.shifts.createTrip(id, user.businessId, dto);
  }
}
```

- [ ] **Step 6: Create the module and register it**

`apps/api/src/shifts/shifts.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ShiftsAdminController } from './shifts.admin.controller';
import { ShiftsService } from './shifts.service';

@Module({
  controllers: [ShiftsAdminController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
```

In `apps/api/src/app.module.ts`, add `ShiftsModule` to the imports array:

```typescript
import { ShiftsModule } from './shifts/shifts.module';
// ... inside @Module imports:
ShiftsModule,
```

- [ ] **Step 7: Run tests and verify they pass**

```bash
cd apps/api
npx jest shifts.integration --runInBand --forceExit
```

Expected: All 3 tests PASS.

- [ ] **Step 8: Add close-trip endpoint to liquidations controller and commit**

Modify `apps/api/src/liquidations/liquidations.controller.ts` to add:

```typescript
import { Controller, Patch, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ShiftsService } from '../shifts/shifts.service';

@Controller('liquidations')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class LiquidationsController {
  constructor(private shifts: ShiftsService) {}

  @Patch(':id/close')
  closeTrip(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.shifts.closeTrip(id, user.businessId, user.userId);
  }
}
```

Update `apps/api/src/liquidations/liquidations.module.ts` to import `ShiftsModule`:

```typescript
import { Module } from '@nestjs/common';
import { LiquidationsController } from './liquidations.controller';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [ShiftsModule],
  controllers: [LiquidationsController],
})
export class LiquidationsModule {}
```

Remove the old `LiquidationsService` — all liquidation logic now lives in `ShiftsService`.

```bash
git add apps/api/src/shifts/ apps/api/src/liquidations/ apps/api/src/app.module.ts
git commit -m "feat(api): add shifts module with trip-based liquidation management"
```

---

### Task 3: Delivery API Module

**Files:**
- Create: `apps/api/src/delivery/delivery.module.ts`
- Create: `apps/api/src/delivery/delivery.service.ts`
- Create: `apps/api/src/delivery/delivery.controller.ts`
- Create: `apps/api/src/delivery/delivery.integration.spec.ts`
- Modify: `apps/api/src/orders/orders.service.ts`
- Modify: `apps/api/src/orders/orders.admin.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing integration test**

`apps/api/src/delivery/delivery.integration.spec.ts`:

```typescript
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
    const category = await prisma.category.create({ data: { businessId, name: 'Cat' } });
    const product = await prisma.product.create({
      data: { businessId, categoryId: category.id, name: 'Combo', price: 80 },
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
    const category2 = await prisma.category.create({ data: { businessId, name: 'Cat2' } });
    const product2 = await prisma.product.create({
      data: { businessId, categoryId: category2.id, name: 'Caldo', price: 60 },
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api
npx jest delivery.integration --runInBand --forceExit
```

Expected: FAIL — routes not found.

- [ ] **Step 3: Create the delivery service**

`apps/api/src/delivery/delivery.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryService {
  constructor(private prisma: PrismaService) {}

  async getMyOrders(userId: string, businessId: string) {
    return this.prisma.order.findMany({
      where: {
        businessId,
        assignedToId: userId,
        status: { in: ['READY', 'OUT_FOR_DELIVERY'] },
      },
      include: {
        items: {
          include: { product: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markOutForDelivery(orderId: string, userId: string, businessId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, businessId },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.assignedToId !== userId) throw new ForbiddenException('No tienes permiso para este pedido');
    if (order.status !== 'READY') {
      throw new ForbiddenException('El pedido debe estar en estado READY para salir a entregar');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'OUT_FOR_DELIVERY' },
    });
  }

  async deliver(orderId: string, userId: string, businessId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, businessId },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.assignedToId !== userId) throw new ForbiddenException('No tienes permiso para este pedido');
    if (order.status !== 'OUT_FOR_DELIVERY') {
      throw new ForbiddenException('El pedido debe estar en OUT_FOR_DELIVERY para confirmarlo como entregado');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED', isPaid: true },
    });
  }

  async notifyReturn(userId: string, businessId: string) {
    // Find users who can receive admin notifications (OWNER, ADMIN, OPERATOR)
    const adminTokens = await this.prisma.deviceToken.findMany({
      where: {
        user: { businessId, role: { in: ['OWNER', 'ADMIN', 'OPERATOR'] } },
      },
      select: { token: true },
    });
    return { notified: adminTokens.length, message: 'Notificación enviada al admin' };
  }
}
```

- [ ] **Step 4: Create delivery controller**

`apps/api/src/delivery/delivery.controller.ts`:

```typescript
import { Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
@Roles(Role.DELIVERY)
export class DeliveryController {
  constructor(private delivery: DeliveryService) {}

  @Get('orders')
  getMyOrders(@CurrentUser() user: CurrentUserPayload) {
    return this.delivery.getMyOrders(user.userId, user.businessId);
  }

  @Patch('orders/:id/out-for-delivery')
  outForDelivery(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.delivery.markOutForDelivery(id, user.userId, user.businessId);
  }

  @Patch('orders/:id/deliver')
  deliver(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.delivery.deliver(id, user.userId, user.businessId);
  }

  @Post('notify-return')
  notifyReturn(@CurrentUser() user: CurrentUserPayload) {
    return this.delivery.notifyReturn(user.userId, user.businessId);
  }
}
```

- [ ] **Step 5: Add `confirm-transfer` to Orders admin controller and service**

In `apps/api/src/orders/orders.service.ts`, add this method:

```typescript
async confirmTransfer(orderId: string, businessId: string) {
  const order = await this.prisma.order.findFirst({
    where: { id: orderId, businessId, paymentMethod: 'TRANSFER' },
  });
  if (!order) throw new NotFoundException('Pedido no encontrado');
  if (order.transferConfirmed) {
    throw new BadRequestException('La transferencia ya fue confirmada');
  }

  return this.prisma.order.update({
    where: { id: orderId },
    data: {
      transferConfirmed: true,
      status: 'IN_PREPARATION',
    },
  });
}
```

In `apps/api/src/orders/orders.admin.controller.ts`, add:

```typescript
@Patch(':id/confirm-transfer')
confirmTransfer(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
  return this.orders.confirmTransfer(id, user.businessId);
}
```

- [ ] **Step 6: Create delivery module and register**

`apps/api/src/delivery/delivery.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
```

Add `DeliveryModule` to `apps/api/src/app.module.ts` imports.

Also update `apps/api/src/auth/guards/roles.guard.ts` to ensure `Role.DELIVERY` is recognized — if roles guard uses `Role[]` from `@prisma/client`, it already works since we added `DELIVERY` to the enum.

- [ ] **Step 7: Run tests and verify pass**

```bash
cd apps/api
npx jest delivery.integration --runInBand --forceExit
```

Expected: All 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/delivery/ apps/api/src/orders/orders.service.ts apps/api/src/orders/orders.admin.controller.ts apps/api/src/app.module.ts
git commit -m "feat(api): add delivery module and confirm-transfer endpoint"
```

---

## Phase 2 — Admin Panel (Tasks 4–6)

Requires Phase 1 to be complete and deployed (or running locally with `pnpm dev`).

---

### Task 4: Admin Panel — Turnos List Page + Open Shift Modal

**Files:**
- Create: `apps/admin/src/app/(admin)/turnos/page.tsx`
- Create: `apps/admin/src/api/shifts.ts`
- Create: `apps/admin/src/hooks/use-shifts.ts`
- Modify: `apps/admin/src/app/(admin)/layout.tsx` (add nav link)

- [ ] **Step 1: Create the API client**

`apps/admin/src/api/shifts.ts`:

```typescript
import { apiClient } from './client';

export interface Shift {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  deliveryUser: { id: string; name: string };
  openedBy: { id: string; name: string };
  liquidations: Array<{
    id: string;
    status: 'OPEN' | 'CLOSED';
    cashTotal: number;
    cardTotal: number;
    transferTotal: number;
    orders: Array<{ id: string; orderNumber: string; status: string; total: number; paymentMethod: string }>;
  }>;
}

export const getShifts = () =>
  apiClient.get<Shift[]>('/shifts').then((r) => r.data);

export const getShift = (id: string) =>
  apiClient.get<Shift>(`/shifts/${id}`).then((r) => r.data);

export const createShift = (data: { deliveryUserId: string; branchId?: string }) =>
  apiClient.post<Shift>('/shifts', data).then((r) => r.data);

export const closeShift = (id: string) =>
  apiClient.patch<Shift>(`/shifts/${id}/close`).then((r) => r.data);

export const createTrip = (shiftId: string, data: { orderIds: string[] }) =>
  apiClient.post(`/shifts/${shiftId}/trips`, data).then((r) => r.data);

export const closeTrip = (tripId: string) =>
  apiClient.patch(`/liquidations/${tripId}/close`).then((r) => r.data);
```

- [ ] **Step 2: Create hooks**

`apps/admin/src/hooks/use-shifts.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShifts, getShift, createShift, closeShift } from '@/api/shifts';

export const useShifts = () =>
  useQuery({ queryKey: ['shifts'], queryFn: getShifts });

export const useShift = (id: string) =>
  useQuery({ queryKey: ['shifts', id], queryFn: () => getShift(id), enabled: !!id });

export const useCreateShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
};

export const useCloseShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closeShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
};
```

- [ ] **Step 3: Fetch delivery users API call**

Add to `apps/admin/src/api/users.ts` (or create if it doesn't exist):

```typescript
export const getDeliveryUsers = () =>
  apiClient.get<Array<{ id: string; name: string; email: string }>>('/users?role=DELIVERY').then((r) => r.data);
```

Check `apps/api/src/users/users.controller.ts` — if the `/users` endpoint doesn't support `?role=` filtering, add it to the service:

In `apps/api/src/users/users.service.ts` `findAll` method, add:

```typescript
async findAll(businessId: string, role?: string) {
  return this.prisma.user.findMany({
    where: { businessId, ...(role && { role: role as Role }) },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
}
```

In `apps/api/src/users/users.controller.ts`:

```typescript
@Get()
findAll(@CurrentUser() user: CurrentUserPayload, @Query('role') role?: string) {
  return this.users.findAll(user.businessId, role);
}
```

Add `@Query` import from `@nestjs/common`.

- [ ] **Step 4: Create the Turnos page**

`apps/admin/src/app/(admin)/turnos/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShifts, useCreateShift, useCloseShift } from '@/hooks/use-shifts';
import { useQuery } from '@tanstack/react-query';
import { getDeliveryUsers } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck } from 'lucide-react';

export default function TurnosPage() {
  const router = useRouter();
  const { data: shifts = [], isLoading } = useShifts();
  const { data: deliveryUsers = [] } = useQuery({ queryKey: ['delivery-users'], queryFn: getDeliveryUsers });
  const createShift = useCreateShift();
  const closeShift = useCloseShift();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const handleCreate = async () => {
    if (!selectedUserId) return;
    await createShift.mutateAsync({ deliveryUserId: selectedUserId });
    setOpen(false);
    setSelectedUserId('');
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Turnos de reparto</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-500 hover:bg-brand-600 text-white">
              <Truck className="w-4 h-4 mr-2" /> Abrir turno
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir nuevo turno</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar repartidor" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                onClick={handleCreate}
                disabled={!selectedUserId || createShift.isPending}
              >
                {createShift.isPending ? 'Abriendo...' : 'Abrir turno'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin turnos hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors"
              onClick={() => router.push(`/turnos/${shift.id}`)}
            >
              <div>
                <p className="font-bold text-gray-900">{shift.deliveryUser.name}</p>
                <p className="text-xs text-gray-500">
                  Abierto: {new Date(shift.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}{shift.liquidations.length} salidas
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={shift.status === 'OPEN' ? 'default' : 'secondary'}>
                  {shift.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                </Badge>
                {shift.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); closeShift.mutate(shift.id); }}
                  >
                    Cerrar turno
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add nav link to layout**

In `apps/admin/src/app/(admin)/layout.tsx`, find the navigation links array and add:

```tsx
{ href: '/turnos', label: 'Repartidores', icon: Truck },
```

Import `Truck` from `lucide-react` in that file.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/(admin)/turnos/ apps/admin/src/api/shifts.ts apps/admin/src/hooks/use-shifts.ts apps/admin/src/app/(admin)/layout.tsx apps/api/src/users/
git commit -m "feat(admin): add turnos page with open/close shift functionality"
```

---

### Task 5: Admin Panel — Turno Detail (Pending Transfers + Assignment + Liquidation)

**Files:**
- Create: `apps/admin/src/app/(admin)/turnos/[id]/page.tsx`
- Modify: `apps/admin/src/api/shifts.ts` (already has all needed functions)
- Modify: `apps/admin/src/hooks/use-shifts.ts` (add trip hooks)

- [ ] **Step 1: Add trip hooks**

Add to `apps/admin/src/hooks/use-shifts.ts`:

```typescript
import { createTrip, closeTrip } from '@/api/shifts';
import { confirmTransfer } from '@/api/orders';

export const useCreateTrip = (shiftId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) => createTrip(shiftId, { orderIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts', shiftId] }),
  });
};

export const useCloseTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closeTrip,
    onSuccess: (_, tripId) => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
};
```

Add to `apps/admin/src/api/orders.ts` (or create):

```typescript
export const confirmTransfer = (orderId: string) =>
  apiClient.patch(`/orders/${orderId}/confirm-transfer`).then((r) => r.data);

export const getReadyOrders = () =>
  apiClient.get<Order[]>('/orders?status=READY').then((r) => r.data);
```

Check that the orders API supports `?status=` filtering — if not, add to orders controller:

```typescript
@Get()
findAll(@CurrentUser() user: CurrentUserPayload, @Query('status') status?: string) {
  return this.orders.findActive(user.businessId, status as OrderStatus);
}
```

And update `findActive` in `orders.service.ts` to accept an optional status filter.

- [ ] **Step 2: Add `useConfirmTransfer` and `useReadyOrders` hooks**

Add to `apps/admin/src/hooks/use-shifts.ts`:

```typescript
import { getReadyOrders, confirmTransfer } from '@/api/orders';

export const useReadyOrders = () =>
  useQuery({ queryKey: ['orders', 'ready'], queryFn: getReadyOrders });

export const useConfirmTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
};
```

- [ ] **Step 3: Create the Turno detail page**

`apps/admin/src/app/(admin)/turnos/[id]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useShift, useCreateTrip, useCloseTrip, useCloseShift, useReadyOrders, useConfirmTransfer } from '@/hooks/use-shifts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPrice } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function TurnoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: shift, isLoading } = useShift(id);
  const { data: readyOrders = [] } = useReadyOrders();
  const createTrip = useCreateTrip(id);
  const closeTrip = useCloseTrip();
  const closeShift = useCloseShift();
  const confirmTransfer = useConfirmTransfer();
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  if (isLoading || !shift) return <div className="p-8 text-sm text-gray-400">Cargando...</div>;

  // Orders with pending transfer (CONFIRMED + paymentMethod=TRANSFER + !transferConfirmed)
  const pendingTransfers = readyOrders.filter(
    (o: any) => o.paymentMethod === 'TRANSFER' && !o.transferConfirmed && o.status === 'CONFIRMED',
  );

  // READY orders not already in a trip
  const assignableOrders = readyOrders.filter(
    (o: any) => o.status === 'READY' && !o.liquidationId &&
      !(o.paymentMethod === 'TRANSFER' && !o.transferConfirmed),
  );

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };

  const handleCreateTrip = async () => {
    if (selectedOrderIds.length === 0) return;
    await createTrip.mutateAsync(selectedOrderIds);
    setSelectedOrderIds([]);
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/turnos" className="flex items-center text-sm text-gray-500 mb-4 hover:text-gray-700">
        <ChevronLeft className="w-4 h-4 mr-1" /> Turnos
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{shift.deliveryUser.name}</h1>
          <p className="text-sm text-gray-500">
            Abierto por {shift.openedBy.name} · {new Date(shift.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {shift.status === 'OPEN' && (
          <Button variant="outline" onClick={() => closeShift.mutate(id)} disabled={closeShift.isPending}>
            Cerrar turno
          </Button>
        )}
      </div>

      {/* Pending transfers */}
      {pendingTransfers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <h2 className="font-bold text-orange-800 mb-3 text-sm">Esperando transferencia</h2>
          <div className="space-y-2">
            {pendingTransfers.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">#{order.orderNumber} — {order.customerName}</p>
                  <p className="text-xs text-gray-500">{formatPrice(order.total)}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => confirmTransfer.mutate(order.id)}
                  disabled={confirmTransfer.isPending}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Confirmar pago
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create new trip */}
      {shift.status === 'OPEN' && assignableOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h2 className="font-bold text-gray-900 mb-3 text-sm">Nueva salida</h2>
          <div className="space-y-2 mb-4">
            {assignableOrders.map((order: any) => (
              <label key={order.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <Checkbox
                  checked={selectedOrderIds.includes(order.id)}
                  onCheckedChange={() => toggleOrder(order.id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">#{order.orderNumber} — {order.customerName}</p>
                  <p className="text-xs text-gray-500">{order.deliveryAddress} · {formatPrice(order.total)} · {order.paymentMethod}</p>
                </div>
              </label>
            ))}
          </div>
          <Button
            className="bg-brand-500 hover:bg-brand-600 text-white w-full"
            disabled={selectedOrderIds.length === 0 || createTrip.isPending}
            onClick={handleCreateTrip}
          >
            {createTrip.isPending ? 'Enviando...' : `Crear salida con ${selectedOrderIds.length} pedido(s)`}
          </Button>
        </div>
      )}

      {/* Existing trips */}
      <div className="space-y-4">
        <h2 className="font-bold text-gray-900 text-sm">Salidas</h2>
        {shift.liquidations.length === 0 ? (
          <p className="text-sm text-gray-400">Sin salidas registradas</p>
        ) : (
          shift.liquidations.map((trip) => (
            <div key={trip.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={trip.status === 'OPEN' ? 'default' : 'secondary'}>
                  {trip.status === 'OPEN' ? 'En curso' : 'Liquidada'}
                </Badge>
                {trip.status === 'OPEN' && (
                  <Button size="sm" variant="outline" onClick={() => closeTrip.mutate(trip.id)}>
                    Liquidar salida
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {trip.orders.map((order) => (
                  <div key={order.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">#{order.orderNumber} — {order.status}</span>
                    <span className="font-medium">{formatPrice(Number(order.total))}</span>
                  </div>
                ))}
              </div>
              {trip.status === 'CLOSED' && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-gray-500">Efectivo</p><p className="font-bold">{formatPrice(Number(trip.cashTotal))}</p></div>
                  <div><p className="text-gray-500">Tarjeta</p><p className="font-bold">{formatPrice(Number(trip.cardTotal))}</p></div>
                  <div><p className="text-gray-500">Transferencia</p><p className="font-bold">{formatPrice(Number(trip.transferTotal))}</p></div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/(admin)/turnos/[id]/ apps/admin/src/hooks/use-shifts.ts apps/admin/src/api/orders.ts
git commit -m "feat(admin): add turno detail with transfer confirmation, order assignment, and trip liquidation"
```

---

### Task 6: Admin Panel — Liquidaciones Page Refactor

**Files:**
- Modify: `apps/admin/src/app/(admin)/liquidaciones/page.tsx`
- Modify: `apps/admin/src/hooks/use-liquidations.ts`
- Modify: `apps/admin/src/api/liquidations.ts`

- [ ] **Step 1: Update the liquidations API and hook**

Check `apps/admin/src/api/liquidations.ts` and `apps/admin/src/hooks/use-liquidations.ts` for the old `Liquidation` model shape. Update them to use the new shape:

`apps/admin/src/api/liquidations.ts`:

```typescript
import { apiClient } from './client';

export interface Liquidation {
  id: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  notes: string | null;
  shift: {
    deliveryUser: { name: string };
    openedAt: string;
  };
  confirmedBy: { name: string } | null;
  orders: Array<{ id: string; orderNumber: string; status: string; total: number }>;
}

export const getLiquidations = () =>
  apiClient.get<Liquidation[]>('/liquidations').then((r) => r.data);
```

Note: The API needs a `GET /liquidations` endpoint. Add it to `apps/api/src/liquidations/liquidations.controller.ts`:

```typescript
@Get()
findAll(@CurrentUser() user: CurrentUserPayload) {
  return this.prisma.liquidation.findMany({
    where: { businessId: user.businessId },
    include: {
      shift: { include: { deliveryUser: { select: { name: true } } } },
      confirmedBy: { select: { name: true } },
      orders: { select: { id: true, orderNumber: true, status: true, total: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

Inject `PrismaService` into `LiquidationsController` constructor for this query.

- [ ] **Step 2: Rewrite the liquidaciones page**

`apps/admin/src/app/(admin)/liquidaciones/page.tsx`:

```tsx
'use client';

import { useLiquidations } from '@/hooks/use-liquidations';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export default function LiquidacionesPage() {
  const { data: liquidations = [], isLoading } = useLiquidations();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Historial de liquidaciones</h1>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : liquidations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin liquidaciones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liquidations.map((liq) => (
            <div key={liq.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">{liq.shift.deliveryUser.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(liq.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    {liq.confirmedBy && ` · Liquidó: ${liq.confirmedBy.name}`}
                  </p>
                </div>
                <Badge variant={liq.status === 'OPEN' ? 'default' : 'secondary'}>
                  {liq.status === 'OPEN' ? 'En curso' : 'Cerrada'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-gray-500 text-xs">Efectivo</p><p className="font-bold">{formatPrice(Number(liq.cashTotal))}</p></div>
                <div><p className="text-gray-500 text-xs">Tarjeta</p><p className="font-bold">{formatPrice(Number(liq.cardTotal))}</p></div>
                <div><p className="text-gray-500 text-xs">Transferencia</p><p className="font-bold">{formatPrice(Number(liq.transferTotal))}</p></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{liq.orders.length} pedidos</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/(admin)/liquidaciones/ apps/admin/src/hooks/use-liquidations.ts apps/admin/src/api/liquidations.ts apps/api/src/liquidations/
git commit -m "feat(admin): refactor liquidaciones page for new per-trip model"
```

---

## Phase 3 — Mobile DELIVERY Mode (Tasks 7–8)

---

### Task 7: Mobile — DELIVERY Role Navigation

**Files:**
- Modify: `apps/mobile/app/login.tsx`
- Create: `apps/mobile/app/(delivery)/_layout.tsx`
- Create: `apps/mobile/app/(delivery)/mis-pedidos/index.tsx`
- Create: `apps/mobile/app/(delivery)/perfil.tsx`
- Create: `apps/mobile/src/api/delivery.ts`
- Create: `apps/mobile/src/hooks/use-delivery-orders.ts`

- [ ] **Step 1: Update login to branch by role**

In `apps/mobile/app/login.tsx`, find line 42:

```typescript
      router.push('/(tabs)/pedidos');
```

Replace with:

```typescript
      if (data.user.role === 'DELIVERY') {
        router.push('/(delivery)/mis-pedidos');
      } else {
        router.push('/(tabs)/pedidos');
      }
```

- [ ] **Step 2: Create the delivery tab layout**

`apps/mobile/app/(delivery)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function DeliveryTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1A1A2E',
          borderTopColor: '#2D2D44',
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="mis-pedidos"
        options={{ title: 'Mis pedidos', tabBarIcon: ({ focused }) => <TabIcon emoji="🛵" focused={focused} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Create the API client**

`apps/mobile/src/api/delivery.ts`:

```typescript
import { apiClient } from './client';

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  total: number;
  paymentMethod: string;
  notes: string | null;
  items: Array<{
    quantity: number;
    price: number;
    subtotal: number;
    product: { name: string };
  }>;
}

export const getMyDeliveryOrders = () =>
  apiClient.get<DeliveryOrder[]>('/delivery/orders').then((r) => r.data);

export const markOutForDelivery = (orderId: string) =>
  apiClient.patch<DeliveryOrder>(`/delivery/orders/${orderId}/out-for-delivery`).then((r) => r.data);

export const confirmDelivery = (orderId: string) =>
  apiClient.patch<DeliveryOrder>(`/delivery/orders/${orderId}/deliver`).then((r) => r.data);

export const notifyReturn = () =>
  apiClient.post('/delivery/notify-return').then((r) => r.data);
```

- [ ] **Step 4: Create the hook**

`apps/mobile/src/hooks/use-delivery-orders.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyDeliveryOrders, markOutForDelivery, confirmDelivery, notifyReturn } from '../api/delivery';

export const useDeliveryOrders = () =>
  useQuery({
    queryKey: ['delivery-orders'],
    queryFn: getMyDeliveryOrders,
    refetchInterval: 30_000,
  });

export const useMarkOutForDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markOutForDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-orders'] }),
  });
};

export const useConfirmDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-orders'] }),
  });
};

export const useNotifyReturn = () =>
  useMutation({ mutationFn: notifyReturn });
```

- [ ] **Step 5: Create the Mis Pedidos list screen**

`apps/mobile/app/(delivery)/mis-pedidos/index.tsx`:

```tsx
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useDeliveryOrders } from '../../../src/hooks/use-delivery-orders';

const STATUS_LABEL: Record<string, string> = {
  READY: 'Listo para entregar',
  OUT_FOR_DELIVERY: 'En camino',
  DELIVERED: 'Entregado',
};

const STATUS_COLOR: Record<string, string> = {
  READY: 'bg-purple-500',
  OUT_FOR_DELIVERY: 'bg-blue-500',
  DELIVERED: 'bg-gray-400',
};

export default function MisPedidosScreen() {
  const router = useRouter();
  const { data: orders = [], isLoading, refetch } = useDeliveryOrders();

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-brand-900 pt-14 pb-4 px-5">
        <Text className="text-white text-xl font-black">Mis pedidos</Text>
        <Text className="text-gray-400 text-xs mt-1">{orders.length} pedido(s) activo(s)</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Text className="text-4xl mb-3">🛵</Text>
            <Text className="text-gray-500 text-sm">Sin pedidos asignados</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white rounded-2xl p-4 shadow-sm"
            onPress={() => router.push(`/(delivery)/mis-pedidos/${item.id}`)}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-bold text-gray-900">#{item.orderNumber}</Text>
              <View className={`px-2 py-0.5 rounded-full ${STATUS_COLOR[item.status] ?? 'bg-gray-400'}`}>
                <Text className="text-white text-[10px] font-bold">
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-gray-700 font-medium">{item.customerName}</Text>
            <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>{item.deliveryAddress}</Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-xs text-gray-500">{item.paymentMethod}</Text>
              <Text className="text-sm font-bold text-brand-500">${Number(item.total).toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 6: Create delivery perfil screen (minimal)**

`apps/mobile/app/(delivery)/perfil.tsx`:

```tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import { logout } from '../../src/api/auth';
import { clearTokens } from '../../src/lib/secure-storage';

export default function DeliveryPerfilScreen() {
  const router = useRouter();
  const { userName, businessName, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try { await logout(); } catch {}
    await clearTokens();
    clearAuth();
    router.replace('/login');
  };

  return (
    <View className="flex-1 bg-gray-50 pt-14 px-5">
      <Text className="text-xl font-black text-gray-900 mb-1">{userName}</Text>
      <Text className="text-sm text-gray-500 mb-8">{businessName} · Repartidor</Text>
      <TouchableOpacity
        className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center"
        onPress={handleLogout}
      >
        <Text className="text-red-600 font-bold">Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/(delivery)/ apps/mobile/app/login.tsx apps/mobile/src/api/delivery.ts apps/mobile/src/hooks/use-delivery-orders.ts
git commit -m "feat(mobile): add DELIVERY role navigation and mis-pedidos list"
```

---

### Task 8: Mobile — Order Detail + Delivery Flow

**Files:**
- Create: `apps/mobile/app/(delivery)/mis-pedidos/_layout.tsx`
- Create: `apps/mobile/app/(delivery)/mis-pedidos/[id].tsx`

- [ ] **Step 1: Create stack layout for mis-pedidos**

`apps/mobile/app/(delivery)/mis-pedidos/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function MisPedidosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
```

- [ ] **Step 2: Create the order detail screen**

`apps/mobile/app/(delivery)/mis-pedidos/[id].tsx`:

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeliveryOrders, useMarkOutForDelivery, useConfirmDelivery, useNotifyReturn } from '../../../src/hooks/use-delivery-orders';
import type { DeliveryOrder } from '../../../src/api/delivery';
import { ChevronLeft } from 'lucide-react-native';

export default function DeliveryOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: orders = [] } = useDeliveryOrders();
  const order = orders.find((o) => o.id === id) as DeliveryOrder | undefined;
  const outForDelivery = useMarkOutForDelivery();
  const confirmDelivery = useConfirmDelivery();
  const notifyReturn = useNotifyReturn();
  const [showSummary, setShowSummary] = useState(false);

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Pedido no encontrado</Text>
      </View>
    );
  }

  const allDelivered = orders.every((o) => o.status === 'DELIVERED');

  const handleConfirmDelivery = () => {
    Alert.alert(
      'Confirmar entrega',
      `¿Confirmas que entregaste el pedido #${order.orderNumber}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await confirmDelivery.mutateAsync(order.id);
            if (allDelivered) setShowSummary(true);
            else router.back();
          },
        },
      ],
    );
  };

  const handleNotifyReturn = async () => {
    await notifyReturn.mutateAsync();
    Alert.alert('Listo', 'Se notificó al administrador que regresaste.');
    router.back();
  };

  if (showSummary) {
    const totalCash = orders
      .filter((o) => o.paymentMethod === 'CASH' && o.status === 'DELIVERED')
      .reduce((s, o) => s + Number(o.total), 0);
    const totalCard = orders
      .filter((o) => o.paymentMethod === 'CARD' && o.status === 'DELIVERED')
      .reduce((s, o) => s + Number(o.total), 0);

    return (
      <View className="flex-1 bg-gray-50 pt-14 px-5">
        <Text className="text-2xl font-black text-gray-900 mb-1">Resumen de salida</Text>
        <Text className="text-gray-500 text-sm mb-6">{orders.length} pedidos entregados</Text>
        <View className="bg-white rounded-2xl p-4 mb-4 space-y-3">
          <View className="flex-row justify-between">
            <Text className="text-gray-600">Efectivo a entregar</Text>
            <Text className="font-black text-brand-500">${totalCash.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-600">Cobrado en tarjeta</Text>
            <Text className="font-bold text-gray-900">${totalCard.toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity
          className="bg-brand-500 rounded-2xl py-5 items-center"
          onPress={handleNotifyReturn}
          disabled={notifyReturn.isPending}
        >
          <Text className="text-white font-bold text-base">
            {notifyReturn.isPending ? 'Enviando...' : '✅ Avisar que regresé'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-brand-900 pt-14 pb-4 px-5">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-2">
          <ChevronLeft size={18} color="#9CA3AF" />
          <Text className="text-gray-400 text-sm">Mis pedidos</Text>
        </TouchableOpacity>
        <Text className="text-white font-black text-xl">Pedido #{order.orderNumber}</Text>
        <Text className="text-gray-400 text-sm mt-1">{order.customerName}</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Address */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Dirección</Text>
          <Text className="text-gray-900 font-medium mb-3">{order.deliveryAddress}</Text>
          <TouchableOpacity
            className="bg-blue-50 rounded-xl py-3 items-center"
            onPress={() =>
              Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress ?? '')}`)
            }
          >
            <Text className="text-blue-600 font-bold text-sm">🗺️ Abrir en Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Customer phone */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Cliente</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}>
            <Text className="text-brand-500 font-bold">📞 {order.customerPhone}</Text>
          </TouchableOpacity>
        </View>

        {/* Items */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-xs text-gray-500 font-semibold uppercase mb-2">Pedido</Text>
          {order.items.map((item, i) => (
            <View key={i} className="flex-row justify-between py-1">
              <Text className="text-gray-700">{item.product.name} ×{item.quantity}</Text>
              <Text className="font-medium">${Number(item.subtotal).toFixed(2)}</Text>
            </View>
          ))}
          <View className="border-t border-gray-100 mt-2 pt-2 flex-row justify-between">
            <Text className="font-bold text-gray-900">Total</Text>
            <Text className="font-black text-brand-500">${Number(order.total).toFixed(2)}</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-1">Pago: {order.paymentMethod}</Text>
        </View>

        {order.notes ? (
          <View className="bg-yellow-50 rounded-2xl p-4 mb-3">
            <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Notas</Text>
            <Text className="text-gray-700">{order.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Action buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 gap-3">
        {order.status === 'READY' && (
          <TouchableOpacity
            className="bg-brand-500 rounded-2xl py-4 items-center"
            onPress={() => outForDelivery.mutateAsync(order.id)}
            disabled={outForDelivery.isPending}
          >
            <Text className="text-white font-bold text-base">
              {outForDelivery.isPending ? 'Procesando...' : '🛵 Salir a entregar'}
            </Text>
          </TouchableOpacity>
        )}
        {order.status === 'OUT_FOR_DELIVERY' && (
          <TouchableOpacity
            className="bg-green-500 rounded-2xl py-4 items-center"
            onPress={handleConfirmDelivery}
            disabled={confirmDelivery.isPending}
          >
            <Text className="text-white font-bold text-base">
              {confirmDelivery.isPending ? 'Procesando...' : '✅ Confirmar entrega'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Test in emulator**

Start metro and emulator:

```bash
cd apps/mobile
pnpm start
```

Press `a` for Android emulator. Log in with a user that has `role: DELIVERY`. Verify:
- App redirects to `/(delivery)/mis-pedidos` (not `/(tabs)/pedidos`)
- Assigned orders appear in the list
- Tapping an order opens the detail screen
- "Salir a entregar" button updates status to `OUT_FOR_DELIVERY`
- "Confirmar entrega" button updates to `DELIVERED`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(delivery)/mis-pedidos/
git commit -m "feat(mobile): add delivery order detail and delivery flow screens"
```

---

## Phase 4 — Transfers Web Message + Chat (Tasks 9–11)

---

### Task 9: Web — Transfer Pending Message in Order Tracking

**Files:**
- Modify: `apps/web/src/components/order/order-status.tsx`

- [ ] **Step 1: Add transfer pending message**

In `apps/web/src/components/order/order-status.tsx`, find the `OrderStatusResponse` type used in the component. Verify it includes `paymentMethod` and `transferConfirmed`. If not, add them to the API type in `apps/web/src/lib/api.ts`:

```typescript
export interface OrderStatusResponse {
  // ... existing fields ...
  paymentMethod: string | null;
  transferConfirmed: boolean;
  assignedToId: string | null;
}
```

In `order-status.tsx`, inside the JSX after the polling countdown section, add a transfer pending card when applicable. Find the items summary card and add after it (before the countdown section):

```tsx
{/* Transfer pending message */}
{order.paymentMethod === 'TRANSFER' && !order.transferConfirmed && !isTerminal && (
  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
    <p className="text-sm font-bold text-orange-800 mb-1">⏳ Pago pendiente</p>
    <p className="text-sm text-orange-700">
      Tu pedido está confirmado. Por favor envía tu pago por transferencia y manda el comprobante por WhatsApp al negocio.
    </p>
  </div>
)}
```

- [ ] **Step 2: Verify the API includes the new fields**

In `apps/api/src/orders/orders.service.ts`, find the `getStatus` method. Ensure it selects `paymentMethod`, `transferConfirmed`, and `assignedToId` in the return:

```typescript
async getStatus(slug: string, orderNumber: string) {
  const business = await this.prisma.business.findUnique({ where: { slug } });
  if (!business) throw new NotFoundException('Negocio no encontrado');

  return this.prisma.order.findFirst({
    where: { businessId: business.id, orderNumber },
    select: {
      id: true, orderNumber: true, status: true, deliveryType: true,
      subtotal: true, discount: true, deliveryFee: true, total: true,
      paymentMethod: true, transferConfirmed: true, assignedToId: true,
      items: {
        select: {
          quantity: true, subtotal: true,
          product: { select: { name: true } },
        },
      },
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/order/order-status.tsx apps/web/src/lib/api.ts apps/api/src/orders/orders.service.ts
git commit -m "feat(web): add transfer pending message in order tracking"
```

---

### Task 10: Chat — API Lifecycle (Firebase Realtime Database)

**Files:**
- Create: `apps/api/src/notifications/rtdb.service.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts`
- Modify: `apps/api/src/delivery/delivery.service.ts`

- [ ] **Step 1: Create the RTDB service**

`apps/api/src/notifications/rtdb.service.ts`:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

@Injectable()
export class RtdbService implements OnModuleInit {
  private readonly logger = new Logger(RtdbService.name);
  private initialized = false;

  onModuleInit() {
    // Reuse the existing Firebase Admin app initialized by FcmService
    // If no app initialized yet (FcmService not configured), skip gracefully
    if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_DATABASE_URL) {
      this.logger.warn('FIREBASE_DATABASE_URL not set — chat disabled');
      return;
    }
    this.initialized = true;
  }

  async createChatRoom(orderId: string): Promise<void> {
    if (!this.initialized) return;
    try {
      const db = getDatabase(getApps()[0]);
      await db.ref(`chats/${orderId}`).set({ active: true, messages: {} });
    } catch (err) {
      this.logger.error(`Failed to create chat room for order ${orderId}`, err);
    }
  }

  async deleteChatRoom(orderId: string): Promise<void> {
    if (!this.initialized) return;
    try {
      const db = getDatabase(getApps()[0]);
      await db.ref(`chats/${orderId}`).remove();
    } catch (err) {
      this.logger.error(`Failed to delete chat room for order ${orderId}`, err);
    }
  }
}
```

Add `FIREBASE_DATABASE_URL` to the Firebase Admin initialization in `FcmService.onModuleInit()`:

```typescript
initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});
```

- [ ] **Step 2: Register RtdbService in the notifications module**

In `apps/api/src/notifications/notifications.module.ts`, add `RtdbService` to providers and exports:

```typescript
import { RtdbService } from './rtdb.service';

@Module({
  // ...
  providers: [NotificationsService, FcmService, NotificationsGateway, RtdbService],
  exports: [NotificationsService, RtdbService],
})
```

- [ ] **Step 3: Wire chat lifecycle into delivery service**

In `apps/api/src/delivery/delivery.service.ts`, inject `RtdbService` and call it when assigning and delivering:

Update constructor:

```typescript
import { RtdbService } from '../notifications/rtdb.service';

constructor(
  private prisma: PrismaService,
  private rtdb: RtdbService,
) {}
```

In `deliver()` method, after updating the order status, add:

```typescript
await this.rtdb.deleteChatRoom(orderId);
```

- [ ] **Step 4: Call createChatRoom when orders are assigned to a trip**

In `apps/api/src/shifts/shifts.service.ts`, inject `RtdbService` and after creating the trip in `createTrip()`, call:

```typescript
// After tx.order.updateMany
for (const orderId of dto.orderIds) {
  await this.rtdb.createChatRoom(orderId);
}
```

Update `ShiftsModule` to import `NotificationsModule`:

```typescript
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ShiftsAdminController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
```

And `DeliveryModule`:

```typescript
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
```

- [ ] **Step 5: Add env var to Coolify and commit**

Add `FIREBASE_DATABASE_URL` to the API environment variables in Coolify. The value is in the Firebase console under Project Settings → General → Your apps → `databaseURL` (format: `https://<project-id>-default-rtdb.firebaseio.com`).

```bash
git add apps/api/src/notifications/rtdb.service.ts apps/api/src/notifications/notifications.module.ts apps/api/src/delivery/delivery.service.ts apps/api/src/shifts/shifts.service.ts apps/api/src/shifts/shifts.module.ts apps/api/src/delivery/delivery.module.ts
git commit -m "feat(api): add Firebase RTDB service for chat room lifecycle management"
```

---

### Task 11: Chat — Mobile Chat Panel

**Files:**
- Modify: `apps/mobile/package.json` (add firebase)
- Create: `apps/mobile/src/components/DeliveryChatPanel.tsx`
- Modify: `apps/mobile/app/(delivery)/mis-pedidos/[id].tsx`

- [ ] **Step 1: Install Firebase JS SDK**

```bash
cd apps/mobile
pnpm add firebase
```

- [ ] **Step 2: Create Firebase client config**

Create `apps/mobile/src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const rtdb = getDatabase(app);
```

Add these `EXPO_PUBLIC_FIREBASE_*` env vars to `apps/mobile/.env`. Values come from Firebase console → Project Settings → General → Your apps → Firebase SDK snippet → Config.

- [ ] **Step 3: Create the chat panel component**

`apps/mobile/src/components/DeliveryChatPanel.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ref, onValue, push, off } from 'firebase/database';
import { rtdb } from '../lib/firebase';

interface Message {
  id: string;
  from: 'CUSTOMER' | 'DELIVERY';
  text: string;
  ts: number;
}

interface Props {
  orderId: string;
}

export function DeliveryChatPanel({ orderId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const messagesRef = ref(rtdb, `chats/${orderId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setMessages([]); return; }
      const msgs = Object.entries(data).map(([id, val]) => ({ id, ...(val as Omit<Message, 'id'>) }));
      msgs.sort((a, b) => a.ts - b.ts);
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => off(messagesRef, 'value', unsubscribe as Parameters<typeof off>[2]);
  }, [orderId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    await push(ref(rtdb, `chats/${orderId}/messages`), {
      from: 'DELIVERY',
      text: text.trim(),
      ts: Date.now(),
    });
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
        renderItem={({ item }) => (
          <View
            className={`max-w-[80%] px-3 py-2 rounded-2xl ${
              item.from === 'DELIVERY'
                ? 'self-end bg-brand-500'
                : 'self-start bg-white border border-gray-200'
            }`}
          >
            <Text className={item.from === 'DELIVERY' ? 'text-white text-sm' : 'text-gray-800 text-sm'}>
              {item.text}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-center text-gray-400 text-xs py-4">
            Chat activo con el cliente
          </Text>
        }
      />
      <View className="flex-row items-center gap-2 px-4 py-3 bg-white border-t border-gray-100">
        <TextInput
          className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm"
          placeholder="Escribe un mensaje..."
          value={text}
          onChangeText={setText}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          className="bg-brand-500 rounded-xl px-4 py-3"
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Text className="text-white font-bold text-sm">Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 4: Add chat tab to order detail screen**

In `apps/mobile/app/(delivery)/mis-pedidos/[id].tsx`, add state for active tab and render the chat panel when tab is 'chat':

At top of component:

```tsx
import { DeliveryChatPanel } from '../../../src/components/DeliveryChatPanel';
const [activeTab, setActiveTab] = useState<'detail' | 'chat'>('detail');
```

After the `ScrollView` (before action buttons), add tab switcher:

```tsx
{/* Tab switcher */}
<View className="flex-row bg-gray-100 rounded-xl mx-5 mt-3 p-1">
  {(['detail', 'chat'] as const).map((tab) => (
    <TouchableOpacity
      key={tab}
      className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-white shadow-sm' : ''}`}
      onPress={() => setActiveTab(tab)}
    >
      <Text className={`text-sm font-bold ${activeTab === tab ? 'text-brand-500' : 'text-gray-500'}`}>
        {tab === 'detail' ? '📦 Detalle' : '💬 Chat'}
      </Text>
    </TouchableOpacity>
  ))}
</View>

{activeTab === 'chat' ? (
  <View className="flex-1 bg-gray-50 mt-2">
    <DeliveryChatPanel orderId={order.id} />
  </View>
) : (
  // existing ScrollView content here
  <ScrollView ...>...</ScrollView>
)}
```

Show chat tab only if order is not in terminal status:

```tsx
{order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
  // tab switcher here
)}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/DeliveryChatPanel.tsx apps/mobile/src/lib/firebase.ts apps/mobile/app/(delivery)/mis-pedidos/[id].tsx apps/mobile/package.json apps/mobile/.env
git commit -m "feat(mobile): add real-time chat panel for delivery driver"
```

---

### Task 12: Chat — Web Order Tracking Chat Panel

**Files:**
- Modify: `apps/web/package.json` (add firebase)
- Create: `apps/web/src/lib/firebase.ts`
- Create: `apps/web/src/components/order/chat-panel.tsx`
- Modify: `apps/web/src/components/order/order-status.tsx`

- [ ] **Step 1: Install Firebase JS SDK**

```bash
cd apps/web
pnpm add firebase
```

- [ ] **Step 2: Create Firebase client config**

`apps/web/src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const rtdb = getDatabase(app);
```

Add `NEXT_PUBLIC_FIREBASE_*` vars to `apps/web/.env.local`.

- [ ] **Step 3: Create the chat panel component**

`apps/web/src/components/order/chat-panel.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, off } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

interface Message {
  id: string;
  from: 'CUSTOMER' | 'DELIVERY';
  text: string;
  ts: number;
}

interface Props {
  orderId: string;
}

export function ChatPanel({ orderId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesRef = ref(rtdb, `chats/${orderId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setMessages([]); return; }
      const msgs = Object.entries(data).map(([id, val]) => ({ id, ...(val as Omit<Message, 'id'>) }));
      msgs.sort((a, b) => a.ts - b.ts);
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return () => off(messagesRef, 'value', unsubscribe as Parameters<typeof off>[2]);
  }, [orderId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    await push(ref(rtdb, `chats/${orderId}/messages`), {
      from: 'CUSTOMER',
      text: text.trim(),
      ts: Date.now(),
    });
    setText('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-bold text-brand-900 text-sm">💬 Chat con el repartidor</h2>
      </div>
      <div className="h-48 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 pt-4">
            El repartidor ya viene en camino. Puedes escribirle aquí.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                msg.from === 'CUSTOMER'
                  ? 'self-end ml-auto bg-brand-500 text-white'
                  : 'self-start bg-gray-100 text-gray-800'
              }`}
            >
              {msg.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
        <input
          type="text"
          className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
          placeholder="Escribe un mensaje..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button
          className="bg-brand-500 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          onClick={sendMessage}
          disabled={!text.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add chat panel to order tracking page**

In `apps/web/src/components/order/order-status.tsx`, import `ChatPanel` and render it when the order has a repartidor assigned and is not terminal:

```tsx
import { ChatPanel } from './chat-panel';
```

After the timeline section (`{!isCancelled && (...)}`) and before the items summary, add:

```tsx
{/* Chat with delivery driver */}
{order.assignedToId && !isTerminal && !isCancelled && (
  <ChatPanel orderId={order.id} />
)}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/order/chat-panel.tsx apps/web/src/lib/firebase.ts apps/web/src/components/order/order-status.tsx apps/web/package.json
git commit -m "feat(web): add real-time customer-driver chat in order tracking"
```

---

## Final Verification

After all tasks are complete:

- [ ] Run full API tests:
  ```bash
  cd apps/api && npx jest --runInBand --forceExit
  ```
  Expected: All existing tests pass + new shifts.integration + delivery.integration pass.

- [ ] Test admin panel flow in browser:
  1. Log in as OWNER
  2. Go to `/turnos` → Open a shift for a DELIVERY user
  3. Go to shift detail → Assign READY orders to a trip
  4. Go back after "repartidor regresa" → Liquidate trip
  5. Close shift
  6. Go to `/liquidaciones` → Verify the liquidated trip appears

- [ ] Test mobile DELIVERY flow in emulator:
  1. Log in with `role: DELIVERY` user → verify redirect to `/(delivery)/mis-pedidos`
  2. Assigned orders visible
  3. Tap order → "Salir a entregar" → status updates
  4. "Confirmar entrega" → status `DELIVERED`
  5. Chat tab visible and functional when order is active

- [ ] Test web tracking:
  1. Place a TRANSFER order
  2. Order tracking shows the "pago pendiente" message
  3. After admin confirms transfer → message disappears
  4. When repartidor assigned → chat panel appears
  5. Messages sync in real-time between web and mobile
