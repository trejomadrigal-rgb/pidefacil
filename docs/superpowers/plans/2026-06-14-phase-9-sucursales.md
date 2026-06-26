# Phase 9 — Sucursales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar soporte multi-sucursal completo: Branch model con GPS, disponibilidad de platillos por sucursal, programación de menús por sucursal, control de dispositivos por plan, flujo de pago con forma de pago obligatoria, estado OUT_FOR_DELIVERY, y liquidación de efectivo.

**Architecture:** La disponibilidad de platillos y menús se maneja con tablas de override (BranchProductAvailability, BranchMenuSchedule) — los productos y menús se definen a nivel negocio y cada sucursal tiene excepciones. Los dispositivos se registran con un fingerprint y requieren aprobación del dueño antes de operar. El web QR detecta la sucursal más cercana vía GPS del navegador.

**Tech Stack:** NestJS + Prisma (API), Next.js + shadcn + TanStack Query (admin), Next.js (web QR), React Native + Expo (mobile).

---

## Task 1: Schema — nuevos modelos y cambios a existentes

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Agregar enums nuevos al schema**

Abrir `apps/api/prisma/schema.prisma`. Después de los enums existentes (buscar `enum OrderStatus`), agregar:

```prisma
enum BranchStatus {
  ACTIVE
  INACTIVE
}

enum DeviceType {
  RECEPTION
  KITCHEN
  DELIVERY
}

enum DeviceStatus {
  PENDING
  ACTIVE
  BLOCKED
}

enum PaymentMethod {
  CASH
  TRANSFER
  OTHER
}
```

- [ ] **Step 2: Agregar OUT_FOR_DELIVERY al enum OrderStatus**

En el enum `OrderStatus` existente, agregar `OUT_FOR_DELIVERY` entre `READY` y `DELIVERED`:

```prisma
enum OrderStatus {
  NEW
  UNDER_REVIEW
  WAITING_CONFIRMATION
  CONFIRMED
  IN_PREPARATION
  READY
  OUT_FOR_DELIVERY
  DELIVERED
  FINISHED
  REJECTED
  CANCELLED
}
```

- [ ] **Step 3: Agregar maxDevices al modelo Plan**

En el modelo `Plan`, agregar campo `maxDevices`:

```prisma
model Plan {
  id           String  @id @default(cuid())
  name         String  @unique
  monthlyPrice Decimal @db.Decimal(10, 2)
  maxUsers     Int
  maxProducts  Int
  maxBranches  Int
  maxDevices   Int     @default(4)

  subscriptions Subscription[]
}
```

- [ ] **Step 4: Agregar campos a Order**

En el modelo `Order`, agregar `branchId`, `paymentMethod`, `isPaid` antes de `createdAt`:

```prisma
  branchId      String?
  paymentMethod PaymentMethod?
  isPaid        Boolean        @default(false)
```

Y en las relaciones del modelo `Order`, agregar:

```prisma
  branch   Branch?  @relation(fields: [branchId], references: [id])
```

Y en los índices:

```prisma
  @@index([branchId])
```

- [ ] **Step 5: Agregar modelo Branch**

Antes del modelo `Plan`, agregar:

```prisma
model Branch {
  id         String       @id @default(cuid())
  businessId String
  name       String
  address    String
  phone      String?
  latitude   Float
  longitude  Float
  status     BranchStatus @default(ACTIVE)
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  business            Business                    @relation(fields: [businessId], references: [id])
  productAvailability BranchProductAvailability[]
  menuSchedules       BranchMenuSchedule[]
  orders              Order[]
  devices             Device[]
  liquidations        Liquidation[]

  @@index([businessId])
}

model BranchProductAvailability {
  branchId    String
  productId   String
  isAvailable Boolean @default(true)

  branch  Branch  @relation(fields: [branchId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@id([branchId, productId])
}

model BranchMenuSchedule {
  id         String  @id @default(cuid())
  branchId   String
  menuId     String
  isActive   Boolean @default(true)
  daysOfWeek Int[]

  branch Branch @relation(fields: [branchId], references: [id])
  menu   Menu   @relation(fields: [menuId], references: [id])

  @@unique([branchId, menuId])
}

model Device {
  id         String       @id @default(cuid())
  businessId String
  branchId   String?
  userId     String?
  name       String
  deviceType DeviceType
  token      String       @unique
  status     DeviceStatus @default(PENDING)
  lastSeenAt DateTime?
  createdAt  DateTime     @default(now())

  business Business @relation(fields: [businessId], references: [id])
  branch   Branch?  @relation(fields: [branchId], references: [id])
  user     User?    @relation(fields: [userId], references: [id])

  @@index([businessId])
}

model Liquidation {
  id             String   @id @default(cuid())
  businessId     String
  branchId       String
  deliveryUserId String
  receivedById   String
  amount         Decimal  @db.Decimal(10, 2)
  notes          String?
  settledAt      DateTime @default(now())

  business     Business @relation(fields: [businessId], references: [id])
  branch       Branch   @relation(fields: [branchId], references: [id])
  deliveryUser User     @relation("DeliveryLiquidations", fields: [deliveryUserId], references: [id])
  receivedBy   User     @relation("ReceivedLiquidations", fields: [receivedById], references: [id])

  @@index([businessId, branchId])
}
```

- [ ] **Step 6: Agregar relaciones en Business, Product, Menu y User**

En el modelo `Business`, agregar en relaciones:
```prisma
  branches     Branch[]
  devices      Device[]
  liquidations Liquidation[]
```

En el modelo `Product`, agregar:
```prisma
  branchAvailability BranchProductAvailability[]
```

En el modelo `Menu`, agregar:
```prisma
  branchSchedules BranchMenuSchedule[]
```

En el modelo `User`, agregar:
```prisma
  devices              Device[]
  deliveryLiquidations Liquidation[] @relation("DeliveryLiquidations")
  receivedLiquidations Liquidation[] @relation("ReceivedLiquidations")
```

- [ ] **Step 7: Generar y aplicar migración**

```bash
cd apps/api
npx prisma migrate dev --name phase9_sucursales
```

Esperado: migración creada y aplicada sin errores. Verifica que el archivo de migración aparece en `prisma/migrations/`.

- [ ] **Step 8: Regenerar cliente Prisma y verificar**

```bash
npx prisma generate
```

Luego ejecutar TypeScript check:
```bash
cd ../..
pnpm tsc --noEmit --filter @pidefacil/api
```

Esperado: 0 errores.

- [ ] **Step 9: Actualizar limpieza en TODOS los integration specs**

Los nuevos modelos tienen FK hacia `Business`, por lo que deben eliminarse antes de `business.deleteMany()`. Agregar en el `beforeEach` de **cada** archivo `*.integration.spec.ts` en `apps/api/src/`, antes de `await prisma.business.deleteMany()`:

```typescript
await prisma.liquidation.deleteMany();
await prisma.device.deleteMany();
await prisma.branchProductAvailability.deleteMany();
await prisma.branchMenuSchedule.deleteMany();
await prisma.branch.deleteMany();
```

Archivos a modificar (buscar con `grep -rl "business.deleteMany" apps/api/src`):
- `auth.integration.spec.ts`
- `business.integration.spec.ts`
- `categories.integration.spec.ts`
- `menus.integration.spec.ts`
- `orders.integration.spec.ts`
- `products.integration.spec.ts`
- `public.integration.spec.ts`
- `super-admin.integration.spec.ts`
- `users.integration.spec.ts`
- `customers.integration.spec.ts`
- `reports.integration.spec.ts`
- `notifications.integration.spec.ts`

- [ ] **Step 10: Ejecutar tests existentes para confirmar que no se rompió nada**

```bash
cd apps/api
pnpm test
```

Esperado: los mismos tests que antes pasan (153+ passing, solo los 2 MinIO failures pre-existentes).

- [ ] **Step 11: Commit**

```bash
git add apps/api/prisma/
git add apps/api/src/**/*.integration.spec.ts
git commit -m "feat(schema): add Branch, Device, Liquidation models + OUT_FOR_DELIVERY + PaymentMethod"
```

---

## Task 2: BranchModule API — CRUD + menu-schedules + product-availability

**Files:**
- Create: `apps/api/src/branches/branches.module.ts`
- Create: `apps/api/src/branches/branches.service.ts`
- Create: `apps/api/src/branches/branches.controller.ts`
- Create: `apps/api/src/branches/dto/create-branch.dto.ts`
- Create: `apps/api/src/branches/dto/update-branch.dto.ts`
- Create: `apps/api/src/branches/dto/upsert-menu-schedules.dto.ts`
- Create: `apps/api/src/branches/dto/update-product-availability.dto.ts`
- Create: `apps/api/src/branches/branches.integration.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear DTOs**

`apps/api/src/branches/dto/create-branch.dto.ts`:
```typescript
import { IsNumber, IsOptional, IsString, MaxLength, MinLength, Max, Min } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
```

`apps/api/src/branches/dto/update-branch.dto.ts`:
```typescript
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BranchStatus } from '@prisma/client';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
}
```

`apps/api/src/branches/dto/upsert-menu-schedules.dto.ts`:
```typescript
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';

export class MenuScheduleItemDto {
  @IsString()
  menuId!: string;

  @IsBoolean()
  isActive!: boolean;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  daysOfWeek!: number[];
}

export class UpsertMenuSchedulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuScheduleItemDto)
  schedules!: MenuScheduleItemDto[];
}
```

`apps/api/src/branches/dto/update-product-availability.dto.ts`:
```typescript
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

export class ProductAvailabilityItemDto {
  @IsString()
  productId!: string;

  @IsBoolean()
  isAvailable!: boolean;
}

export class UpdateProductAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAvailabilityItemDto)
  items!: ProductAvailabilityItemDto[];
}
```

- [ ] **Step 2: Crear el servicio**

`apps/api/src/branches/branches.service.ts`:
```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpsertMenuSchedulesDto } from './dto/upsert-menu-schedules.dto';
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string) {
    return this.prisma.branch.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, businessId } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async create(businessId: string, dto: CreateBranchDto) {
    const sub = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    const max = sub?.plan?.maxBranches ?? 1;
    const current = await this.prisma.branch.count({ where: { businessId, status: 'ACTIVE' } });
    if (current >= max) {
      throw new BadRequestException(
        `Tu plan permite máximo ${max} sucursal(es). Actualiza tu plan para agregar más.`,
      );
    }
    return this.prisma.branch.create({ data: { businessId, ...dto } });
  }

  async update(businessId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(businessId, id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    const activeOrders = await this.prisma.order.count({
      where: {
        branchId: id,
        status: { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED', 'FINISHED'] },
      },
    });
    if (activeOrders > 0) {
      throw new BadRequestException('No se puede eliminar una sucursal con pedidos activos');
    }
    await this.prisma.branch.delete({ where: { id } });
  }

  async getMenuSchedules(businessId: string, branchId: string) {
    await this.findOne(businessId, branchId);
    return this.prisma.branchMenuSchedule.findMany({
      where: { branchId },
      include: { menu: { select: { id: true, name: true, type: true } } },
    });
  }

  async upsertMenuSchedules(businessId: string, branchId: string, dto: UpsertMenuSchedulesDto) {
    await this.findOne(businessId, branchId);
    await this.prisma.$transaction(
      dto.schedules.map((s) =>
        this.prisma.branchMenuSchedule.upsert({
          where: { branchId_menuId: { branchId, menuId: s.menuId } },
          create: { branchId, menuId: s.menuId, isActive: s.isActive, daysOfWeek: s.daysOfWeek },
          update: { isActive: s.isActive, daysOfWeek: s.daysOfWeek },
        }),
      ),
    );
    return this.getMenuSchedules(businessId, branchId);
  }

  async getProductAvailability(businessId: string, branchId: string) {
    await this.findOne(businessId, branchId);
    const products = await this.prisma.product.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        isAvailable: true,
        category: { select: { name: true } },
        branchAvailability: { where: { branchId }, select: { isAvailable: true } },
      },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({
      productId: p.id,
      name: p.name,
      categoryName: p.category.name,
      defaultAvailable: p.isAvailable,
      branchAvailable:
        p.branchAvailability[0]?.isAvailable ?? p.isAvailable,
      hasOverride: p.branchAvailability.length > 0,
    }));
  }

  async updateProductAvailability(
    businessId: string,
    branchId: string,
    dto: UpdateProductAvailabilityDto,
  ) {
    await this.findOne(businessId, branchId);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.branchProductAvailability.upsert({
          where: { branchId_productId: { branchId, productId: item.productId } },
          create: { branchId, productId: item.productId, isAvailable: item.isAvailable },
          update: { isAvailable: item.isAvailable },
        }),
      ),
    );
    return this.getProductAvailability(businessId, branchId);
  }
}
```

- [ ] **Step 3: Crear el controlador**

`apps/api/src/branches/branches.controller.ts`:
```typescript
import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post, Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpsertMenuSchedulesDto } from './dto/upsert-menu-schedules.dto';
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto';

@Controller('admin/branches')
@Roles(Role.OWNER, Role.ADMIN)
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.branchesService.findAll(user.businessId);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user.businessId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.findOne(user.businessId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(user.businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.remove(user.businessId, id);
  }

  @Get(':id/menu-schedules')
  getMenuSchedules(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.getMenuSchedules(user.businessId, id);
  }

  @Put(':id/menu-schedules')
  upsertMenuSchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpsertMenuSchedulesDto,
  ) {
    return this.branchesService.upsertMenuSchedules(user.businessId, id, dto);
  }

  @Get(':id/product-availability')
  getProductAvailability(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.getProductAvailability(user.businessId, id);
  }

  @Patch(':id/product-availability')
  updateProductAvailability(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductAvailabilityDto,
  ) {
    return this.branchesService.updateProductAvailability(user.businessId, id, dto);
  }
}
```

- [ ] **Step 4: Crear el módulo y registrarlo**

`apps/api/src/branches/branches.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
```

En `apps/api/src/app.module.ts`, importar y agregar `BranchesModule`:
```typescript
import { BranchesModule } from './branches/branches.module';
// agregar en imports array:
BranchesModule,
```

- [ ] **Step 5: Escribir integration test**

`apps/api/src/branches/branches.integration.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('BranchesModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda Sucursales Test',
    slug: 'fonda-sucursales-test',
    phone: '5551234567',
    ownerName: 'Dueño Test',
    email: 'owner@sucursales.com',
    password: 'Password123!',
  };

  const branchDto = {
    name: 'Sucursal Centro',
    address: 'Av. Juárez 100, Centro',
    phone: '5559876543',
    latitude: 19.4326,
    longitude: -99.1332,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = module.get<PrismaService>(PrismaService);
    await app.init();
  }, 30000);

  afterAll(async () => { await app.close(); }, 15000);

  beforeEach(async () => {
    await prisma.liquidation.deleteMany();
    await prisma.device.deleteMany();
    await prisma.branchProductAvailability.deleteMany();
    await prisma.branchMenuSchedule.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.subscription.deleteMany();
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
    await prisma.plan.deleteMany();

    const res = await request(app.getHttpServer()).post('/auth/register').send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
  }, 15000);

  describe('POST /admin/branches', () => {
    it('crea una sucursal', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(branchDto)
        .expect(201);
      expect(res.body.name).toBe('Sucursal Centro');
      expect(res.body.businessId).toBe(businessId);
      expect(res.body.latitude).toBe(19.4326);
    });

    it('rechaza sin token', async () => {
      await request(app.getHttpServer()).post('/admin/branches').send(branchDto).expect(401);
    });

    it('valida campos requeridos', async () => {
      await request(app.getHttpServer())
        .post('/admin/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sin coords' })
        .expect(400);
    });
  });

  describe('GET /admin/branches', () => {
    it('lista sucursales del negocio', async () => {
      await prisma.branch.create({ data: { businessId, ...branchDto } });
      const res = await request(app.getHttpServer())
        .get('/admin/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Sucursal Centro');
    });
  });

  describe('PATCH /admin/branches/:id', () => {
    it('actualiza nombre de sucursal', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      const res = await request(app.getHttpServer())
        .patch(`/admin/branches/${branch.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sucursal Norte' })
        .expect(200);
      expect(res.body.name).toBe('Sucursal Norte');
    });

    it('retorna 404 si sucursal no pertenece al negocio', async () => {
      await request(app.getHttpServer())
        .patch('/admin/branches/nonexistent')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'X' })
        .expect(404);
    });
  });

  describe('DELETE /admin/branches/:id', () => {
    it('elimina sucursal sin pedidos activos', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      await request(app.getHttpServer())
        .delete(`/admin/branches/${branch.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });
  });

  describe('PUT /admin/branches/:id/menu-schedules', () => {
    it('guarda horario de menú en sucursal', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      const menu = await prisma.menu.create({ data: { businessId, name: 'Menú Diario', type: 'DAILY' } });
      const res = await request(app.getHttpServer())
        .put(`/admin/branches/${branch.id}/menu-schedules`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ schedules: [{ menuId: menu.id, isActive: true, daysOfWeek: [1, 2, 3, 4, 5] }] })
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('PATCH /admin/branches/:id/product-availability', () => {
    it('establece disponibilidad de platillo en sucursal', async () => {
      const branch = await prisma.branch.create({ data: { businessId, ...branchDto } });
      const cat = await prisma.category.create({ data: { businessId, name: 'Platos' } });
      const product = await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Pozole', price: 80, isAvailable: true },
      });
      const res = await request(app.getHttpServer())
        .patch(`/admin/branches/${branch.id}/product-availability`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ items: [{ productId: product.id, isAvailable: false }] })
        .expect(200);
      const item = res.body.find((p: any) => p.productId === product.id);
      expect(item.branchAvailable).toBe(false);
      expect(item.hasOverride).toBe(true);
    });
  });
});
```

- [ ] **Step 6: Ejecutar tests**

```bash
cd apps/api
pnpm test -- --testPathPattern=branches
```

Esperado: 8+ tests passing.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/branches/ apps/api/src/app.module.ts
git commit -m "feat(api): add BranchesModule with CRUD, menu-schedules, product-availability"
```

---

## Task 3: DeviceModule API — registro, aprobación y guard en auth

**Files:**
- Create: `apps/api/src/devices/devices.module.ts`
- Create: `apps/api/src/devices/devices.service.ts`
- Create: `apps/api/src/devices/devices.controller.ts`
- Create: `apps/api/src/devices/dto/register-device.dto.ts`
- Create: `apps/api/src/devices/dto/update-device.dto.ts`
- Create: `apps/api/src/devices/devices.integration.spec.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear DTOs**

`apps/api/src/devices/dto/register-device.dto.ts`:
```typescript
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DeviceType } from '@prisma/client';

export class RegisterDeviceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(DeviceType)
  deviceType!: DeviceType;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  token!: string;
}
```

`apps/api/src/devices/dto/update-device.dto.ts`:
```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeviceStatus } from '@prisma/client';

export class UpdateDeviceDto {
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  branchId?: string;
}
```

- [ ] **Step 2: Crear el servicio**

`apps/api/src/devices/devices.service.ts`:
```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async register(businessId: string, userId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findUnique({ where: { token: dto.token } });
    if (existing) {
      if (existing.status === 'BLOCKED') {
        throw new ForbiddenException('DEVICE_BLOCKED');
      }
      // Update lastSeenAt and userId
      await this.prisma.device.update({
        where: { token: dto.token },
        data: { userId, lastSeenAt: new Date() },
      });
      return { status: existing.status, deviceId: existing.id };
    }
    const device = await this.prisma.device.create({
      data: { businessId, userId, name: dto.name, deviceType: dto.deviceType, token: dto.token },
    });
    return { status: device.status, deviceId: device.id };
  }

  async findAll(businessId: string) {
    return this.prisma.device.findMany({
      where: { businessId },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(businessId: string, id: string, branchId?: string) {
    const device = await this.prisma.device.findFirst({ where: { id, businessId } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');

    const sub = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    const max = sub?.plan?.maxDevices ?? 4;
    const active = await this.prisma.device.count({ where: { businessId, status: 'ACTIVE' } });
    if (active >= max) {
      throw new BadRequestException(
        `Tu plan permite máximo ${max} dispositivo(s) activo(s). Actualiza tu plan para agregar más.`,
      );
    }

    return this.prisma.device.update({
      where: { id },
      data: { status: 'ACTIVE', branchId: branchId ?? null },
    });
  }

  async block(businessId: string, id: string) {
    const device = await this.prisma.device.findFirst({ where: { id, businessId } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    return this.prisma.device.update({ where: { id }, data: { status: 'BLOCKED' } });
  }

  async remove(businessId: string, id: string) {
    const device = await this.prisma.device.findFirst({ where: { id, businessId } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    await this.prisma.device.delete({ where: { id } });
  }

  async checkToken(token: string): Promise<'PENDING' | 'ACTIVE' | 'BLOCKED' | null> {
    const device = await this.prisma.device.findUnique({
      where: { token },
      select: { status: true },
    });
    return device?.status ?? null;
  }

  async touchLastSeen(token: string) {
    await this.prisma.device.updateMany({
      where: { token },
      data: { lastSeenAt: new Date() },
    });
  }
}
```

- [ ] **Step 3: Crear el controlador**

`apps/api/src/devices/devices.controller.ts`:
```typescript
import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Controller('admin/devices')
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Post('register')
  register(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(user.businessId, user.sub, dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.devicesService.findAll(user.businessId);
  }

  @Patch(':id/approve')
  @Roles(Role.OWNER, Role.ADMIN)
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.approve(user.businessId, id, dto.branchId);
  }

  @Patch(':id/block')
  @Roles(Role.OWNER, Role.ADMIN)
  block(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.devicesService.block(user.businessId, id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(204)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.devicesService.remove(user.businessId, id);
  }
}
```

- [ ] **Step 4: Crear el módulo y registrarlo**

`apps/api/src/devices/devices.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
```

En `apps/api/src/app.module.ts`:
```typescript
import { DevicesModule } from './devices/devices.module';
// agregar en imports:
DevicesModule,
```

- [ ] **Step 5: Escribir y ejecutar integration test**

`apps/api/src/devices/devices.integration.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('DevicesModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda Devices Test',
    slug: 'fonda-devices-test',
    phone: '5551234567',
    ownerName: 'Owner Test',
    email: 'owner@devices.com',
    password: 'Password123!',
  };

  const deviceDto = {
    name: 'Tablet Cocina',
    deviceType: 'KITCHEN',
    token: 'unique-device-token-abc123',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = module.get<PrismaService>(PrismaService);
    await app.init();
  }, 30000);

  afterAll(async () => { await app.close(); }, 15000);

  beforeEach(async () => {
    await prisma.liquidation.deleteMany();
    await prisma.device.deleteMany();
    await prisma.branchProductAvailability.deleteMany();
    await prisma.branchMenuSchedule.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.subscription.deleteMany();
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
    await prisma.plan.deleteMany();

    const res = await request(app.getHttpServer()).post('/auth/register').send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
  }, 15000);

  describe('POST /admin/devices/register', () => {
    it('registra dispositivo nuevo como PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(deviceDto)
        .expect(201);
      expect(res.body.status).toBe('PENDING');
    });

    it('re-registrar el mismo token retorna status existente', async () => {
      await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(deviceDto)
        .expect(201);
      const res = await request(app.getHttpServer())
        .post('/admin/devices/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(deviceDto)
        .expect(201);
      expect(res.body.status).toBe('PENDING');
    });
  });

  describe('PATCH /admin/devices/:id/approve', () => {
    it('aprueba un dispositivo pendiente', async () => {
      const device = await prisma.device.create({
        data: { businessId, name: 'Tablet', deviceType: 'KITCHEN', token: 'tok123' },
      });
      const res = await request(app.getHttpServer())
        .patch(`/admin/devices/${device.id}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(200);
      expect(res.body.status).toBe('ACTIVE');
    });
  });

  describe('PATCH /admin/devices/:id/block', () => {
    it('bloquea un dispositivo', async () => {
      const device = await prisma.device.create({
        data: { businessId, name: 'Tablet', deviceType: 'RECEPTION', token: 'tok456', status: 'ACTIVE' },
      });
      const res = await request(app.getHttpServer())
        .patch(`/admin/devices/${device.id}/block`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.status).toBe('BLOCKED');
    });
  });
});
```

```bash
cd apps/api && pnpm test -- --testPathPattern=devices
```

Esperado: 4+ tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/devices/ apps/api/src/app.module.ts
git commit -m "feat(api): add DevicesModule with registration and approval flow"
```

---

## Task 4: LiquidationModule API

**Files:**
- Create: `apps/api/src/liquidations/liquidations.module.ts`
- Create: `apps/api/src/liquidations/liquidations.service.ts`
- Create: `apps/api/src/liquidations/liquidations.controller.ts`
- Create: `apps/api/src/liquidations/dto/create-liquidation.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear DTO y servicio**

`apps/api/src/liquidations/dto/create-liquidation.dto.ts`:
```typescript
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLiquidationDto {
  @IsString()
  branchId!: string;

  @IsString()
  receivedById!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

`apps/api/src/liquidations/liquidations.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLiquidationDto } from './dto/create-liquidation.dto';

@Injectable()
export class LiquidationsService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, deliveryUserId: string, dto: CreateLiquidationDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    return this.prisma.liquidation.create({
      data: {
        businessId,
        branchId: dto.branchId,
        deliveryUserId,
        receivedById: dto.receivedById,
        amount: dto.amount,
        notes: dto.notes,
      },
      include: {
        branch: { select: { name: true } },
        deliveryUser: { select: { name: true } },
        receivedBy: { select: { name: true } },
      },
    });
  }

  async findAll(businessId: string, branchId?: string) {
    return this.prisma.liquidation.findMany({
      where: { businessId, ...(branchId && { branchId }) },
      include: {
        branch: { select: { name: true } },
        deliveryUser: { select: { name: true } },
        receivedBy: { select: { name: true } },
      },
      orderBy: { settledAt: 'desc' },
    });
  }
}
```

- [ ] **Step 2: Crear controlador y módulo**

`apps/api/src/liquidations/liquidations.controller.ts`:
```typescript
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { LiquidationsService } from './liquidations.service';
import { CreateLiquidationDto } from './dto/create-liquidation.dto';

@Controller('admin/liquidations')
export class LiquidationsController {
  constructor(private liquidationsService: LiquidationsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateLiquidationDto) {
    return this.liquidationsService.create(user.businessId, user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload, @Query('branchId') branchId?: string) {
    return this.liquidationsService.findAll(user.businessId, branchId);
  }
}
```

`apps/api/src/liquidations/liquidations.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { LiquidationsController } from './liquidations.controller';
import { LiquidationsService } from './liquidations.service';

@Module({
  controllers: [LiquidationsController],
  providers: [LiquidationsService],
})
export class LiquidationsModule {}
```

En `apps/api/src/app.module.ts`:
```typescript
import { LiquidationsModule } from './liquidations/liquidations.module';
// agregar en imports:
LiquidationsModule,
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/liquidations/ apps/api/src/app.module.ts
git commit -m "feat(api): add LiquidationsModule"
```

---

## Task 5: Order changes — paymentMethod, OUT_FOR_DELIVERY, confirm-payment

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts`
- Modify: `apps/api/src/orders/orders.controller.ts`
- Modify: `apps/api/src/orders/dto/create-order.dto.ts`
- Modify: `apps/api/src/orders/dto/order-detail.dto.ts`
- Modify: `apps/api/src/orders/orders.integration.spec.ts`

- [ ] **Step 1: Actualizar CreateOrderDto**

En `apps/api/src/orders/dto/create-order.dto.ts`, agregar campo `paymentMethod` y `branchId`:

```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

// dentro de la clase existente, agregar:
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
```

- [ ] **Step 2: Actualizar VALID_TRANSITIONS y updateStatus en orders.service.ts**

En `apps/api/src/orders/orders.service.ts`, actualizar el mapa `VALID_TRANSITIONS`:

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW:                  [OrderStatus.UNDER_REVIEW, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  UNDER_REVIEW:         [OrderStatus.CONFIRMED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  CONFIRMED:            [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
  IN_PREPARATION:       [OrderStatus.READY],
  READY:                [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
  OUT_FOR_DELIVERY:     [OrderStatus.DELIVERED],
  DELIVERED:            [],
  FINISHED:             [],
  REJECTED:             [],
  CANCELLED:            [],
  WAITING_CONFIRMATION: [],
};
```

En el método `updateStatus`, agregar guard antes de la validación de transición:

```typescript
// Agregar después de obtener el order y antes de validar allowed:
if (newStatus === OrderStatus.OUT_FOR_DELIVERY) {
  if (order.paymentMethod !== 'CASH' && !order.isPaid) {
    throw new BadRequestException(
      'El pedido requiere confirmación de pago antes de salir a entrega',
    );
  }
}
```

- [ ] **Step 3: Agregar método confirmPayment en orders.service.ts**

```typescript
async confirmPayment(id: string, businessId: string): Promise<OrderDetailDto> {
  const order = await this.prisma.order.findFirst({ where: { id, businessId } });
  if (!order) throw new NotFoundException('Pedido no encontrado');
  if (order.isPaid) throw new BadRequestException('El pedido ya está marcado como pagado');
  await this.prisma.order.update({ where: { id }, data: { isPaid: true } });
  return this.findOne(id, businessId);
}
```

- [ ] **Step 4: Agregar endpoint confirm-payment en orders.controller.ts**

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

// dentro del controlador existente, agregar:
  @Patch('admin/orders/:id/confirm-payment')
  confirmPayment(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.ordersService.confirmPayment(id, user.businessId);
  }

  @Patch('admin/orders/:id/status')
  updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: { status: string },
  ) {
    return this.ordersService.updateStatus(id, user.businessId, dto.status as any);
  }
```

- [ ] **Step 5: Ejecutar todos los tests de orders**

```bash
cd apps/api && pnpm test -- --testPathPattern=orders
```

Esperado: todos los tests de orders pasan.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/orders/
git commit -m "feat(api): add OUT_FOR_DELIVERY status, paymentMethod field, confirm-payment endpoint"
```

---

## Task 6: PublicModule — branches endpoint + menú filtrado por sucursal

**Files:**
- Modify: `apps/api/src/public/public.controller.ts`
- Modify: `apps/api/src/public/public.service.ts`

- [ ] **Step 1: Agregar endpoint de branches públicas**

En `apps/api/src/public/public.controller.ts`, agregar:

```typescript
@Get('public/business/:slug/branches')
@Public()
getBranches(@Param('slug') slug: string) {
  return this.publicService.getBranches(slug);
}

@Get('public/business/:slug/categories')
@Public()
getCategories(
  @Param('slug') slug: string,
  @Query('branchId') branchId?: string,
) {
  return this.publicService.getCategories(slug, branchId);
}
```

- [ ] **Step 2: Implementar getBranches y actualizar getCategories en public.service.ts**

En `apps/api/src/public/public.service.ts`, agregar método `getBranches`:

```typescript
async getBranches(slug: string) {
  const business = await this.prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) throw new NotFoundException('Negocio no encontrado');

  return this.prisma.branch.findMany({
    where: { businessId: business.id, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { name: 'asc' },
  });
}
```

Actualizar `getCategories` para filtrar por sucursal cuando se pasa `branchId`. Buscar el método existente y agregar lógica de override:

```typescript
async getCategories(slug: string, branchId?: string) {
  // ... lógica existente para obtener categorías con productos ...
  // Después de obtener los productos, si hay branchId, aplicar overrides:
  if (branchId) {
    const overrides = await this.prisma.branchProductAvailability.findMany({
      where: { branchId },
    });
    const overrideMap = new Map(overrides.map((o) => [o.productId, o.isAvailable]));
    // filtrar productos según override
    categories = categories.map((cat) => ({
      ...cat,
      products: cat.products.filter((p) => overrideMap.get(p.id) ?? p.isAvailable),
    }));
  }
  return categories;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/public/
git commit -m "feat(api): add public branches endpoint and branch-filtered categories"
```

---

## Task 7: Admin — Sucursales pages

**Files:**
- Create: `apps/admin/src/api/branches.ts`
- Create: `apps/admin/src/hooks/use-branches.ts`
- Create: `apps/admin/src/app/(admin)/sucursales/page.tsx`
- Create: `apps/admin/src/app/(admin)/sucursales/[id]/page.tsx`
- Modify: `apps/admin/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Crear api/branches.ts**

`apps/admin/src/api/branches.ts`:
```typescript
import { api } from '@/lib/api';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface MenuSchedule {
  id: string;
  menuId: string;
  isActive: boolean;
  daysOfWeek: number[];
  menu: { id: string; name: string; type: string };
}

export interface ProductAvailabilityItem {
  productId: string;
  name: string;
  categoryName: string;
  defaultAvailable: boolean;
  branchAvailable: boolean;
  hasOverride: boolean;
}

export interface Device {
  id: string;
  name: string;
  deviceType: 'RECEPTION' | 'KITCHEN' | 'DELIVERY';
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED';
  lastSeenAt: string | null;
  branch?: { id: string; name: string } | null;
  user?: { id: string; name: string } | null;
}

export const getBranches = () => api.get<Branch[]>('/admin/branches').then((r) => r.data);
export const getBranch = (id: string) => api.get<Branch>(`/admin/branches/${id}`).then((r) => r.data);
export const createBranch = (data: Omit<Branch, 'id' | 'status' | 'createdAt'>) =>
  api.post<Branch>('/admin/branches', data).then((r) => r.data);
export const updateBranch = (id: string, data: Partial<Branch>) =>
  api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data);
export const deleteBranch = (id: string) => api.delete(`/admin/branches/${id}`);

export const getMenuSchedules = (branchId: string) =>
  api.get<MenuSchedule[]>(`/admin/branches/${branchId}/menu-schedules`).then((r) => r.data);
export const upsertMenuSchedules = (branchId: string, schedules: { menuId: string; isActive: boolean; daysOfWeek: number[] }[]) =>
  api.put<MenuSchedule[]>(`/admin/branches/${branchId}/menu-schedules`, { schedules }).then((r) => r.data);

export const getProductAvailability = (branchId: string) =>
  api.get<ProductAvailabilityItem[]>(`/admin/branches/${branchId}/product-availability`).then((r) => r.data);
export const updateProductAvailability = (branchId: string, items: { productId: string; isAvailable: boolean }[]) =>
  api.patch<ProductAvailabilityItem[]>(`/admin/branches/${branchId}/product-availability`, { items }).then((r) => r.data);

export const getDevices = () => api.get<Device[]>('/admin/devices').then((r) => r.data);
export const approveDevice = (id: string, branchId?: string) =>
  api.patch<Device>(`/admin/devices/${id}/approve`, { branchId }).then((r) => r.data);
export const blockDevice = (id: string) =>
  api.patch<Device>(`/admin/devices/${id}/block`).then((r) => r.data);
export const deleteDevice = (id: string) => api.delete(`/admin/devices/${id}`);
```

- [ ] **Step 2: Crear hooks/use-branches.ts**

`apps/admin/src/hooks/use-branches.ts`:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/branches';

export const useBranches = () =>
  useQuery({ queryKey: ['branches'], queryFn: api.getBranches });

export const useBranch = (id: string) =>
  useQuery({ queryKey: ['branches', id], queryFn: () => api.getBranch(id), enabled: !!id });

export const useCreateBranch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBranch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
};

export const useUpdateBranch = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.updateBranch>[1]) => api.updateBranch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
};

export const useDeleteBranch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteBranch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
};

export const useMenuSchedules = (branchId: string) =>
  useQuery({ queryKey: ['branches', branchId, 'schedules'], queryFn: () => api.getMenuSchedules(branchId), enabled: !!branchId });

export const useUpsertMenuSchedules = (branchId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schedules: Parameters<typeof api.upsertMenuSchedules>[1]) => api.upsertMenuSchedules(branchId, schedules),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches', branchId, 'schedules'] }),
  });
};

export const useProductAvailability = (branchId: string) =>
  useQuery({ queryKey: ['branches', branchId, 'availability'], queryFn: () => api.getProductAvailability(branchId), enabled: !!branchId });

export const useUpdateProductAvailability = (branchId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Parameters<typeof api.updateProductAvailability>[1]) => api.updateProductAvailability(branchId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches', branchId, 'availability'] }),
  });
};

export const useDevices = () =>
  useQuery({ queryKey: ['devices'], queryFn: api.getDevices });

export const useApproveDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId?: string }) => api.approveDevice(id, branchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
};

export const useBlockDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.blockDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
};
```

- [ ] **Step 3: Crear página lista de sucursales**

`apps/admin/src/app/(admin)/sucursales/page.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MapPin, Smartphone } from 'lucide-react';
import { useBranches, useDeleteBranch } from '@/hooks/use-branches';

export default function SucursalesPage() {
  const { data: branches = [], isLoading } = useBranches();
  const deleteBranch = useDeleteBranch();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteBranch.mutateAsync(id);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al eliminar sucursal');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Sucursales</h1>
        <Link
          href="/sucursales/nueva"
          className="bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e55a2b] transition-colors"
        >
          + Nueva sucursal
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : branches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No tienes sucursales configuradas</p>
          <p className="text-xs text-gray-400 mt-1">Agrega tu primera sucursal para habilitar el menú multi-ubicación</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="font-bold text-gray-900">{branch.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{branch.address}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${branch.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {branch.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/sucursales/${branch.id}`}
                  className="flex-1 text-center text-xs font-medium border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                >
                  Gestionar
                </Link>
                <button
                  onClick={() => handleDelete(branch.id)}
                  className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Crear página nueva sucursal**

`apps/admin/src/app/(admin)/sucursales/nueva/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateBranch } from '@/hooks/use-branches';

export default function NuevaSucursalPage() {
  const router = useRouter();
  const { mutateAsync, isPending, error } = useCreateBranch();
  const [form, setForm] = useState({
    name: '', address: '', phone: '', latitude: '', longitude: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude.toString(),
        longitude: pos.coords.longitude.toString(),
      }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutateAsync({
      name: form.name,
      address: form.address,
      phone: form.phone || undefined,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
    });
    router.push('/sucursales');
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Nueva sucursal</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {[
          { label: 'Nombre', key: 'name' as const, type: 'text', required: true },
          { label: 'Dirección', key: 'address' as const, type: 'text', required: true },
          { label: 'Teléfono (opcional)', key: 'phone' as const, type: 'tel', required: false },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={set(key)}
              required={required}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
          </div>
        ))}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Coordenadas GPS</label>
            <button type="button" onClick={useMyLocation} className="text-xs text-[#FF6B35] font-medium hover:underline">
              Usar mi ubicación actual
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              placeholder="Latitud"
              value={form.latitude}
              onChange={set('latitude')}
              required
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
            <input
              type="number"
              step="any"
              placeholder="Longitud"
              value={form.longitude}
              onChange={set('longitude')}
              required
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500">
            {(error as any)?.response?.data?.message ?? 'Error al crear sucursal'}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 bg-[#FF6B35] text-white rounded-lg py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50">
            {isPending ? 'Creando...' : 'Crear sucursal'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Crear página detalle de sucursal con 4 pestañas**

`apps/admin/src/app/(admin)/sucursales/[id]/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useBranch, useUpdateBranch, useMenuSchedules, useUpsertMenuSchedules,
  useProductAvailability, useUpdateProductAvailability,
  useDevices, useApproveDevice, useBlockDevice,
} from '@/hooks/use-branches';
import { useMenus } from '@/hooks/use-menus';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DEVICE_TYPE_LABELS = { RECEPTION: 'Recepción', KITCHEN: 'Cocina', DELIVERY: 'Repartidor' };
const DEVICE_STATUS_LABELS = { PENDING: 'Pendiente', ACTIVE: 'Activo', BLOCKED: 'Bloqueado' };
const TABS = ['Info', 'Menús', 'Platillos', 'Dispositivos'] as const;
type Tab = typeof TABS[number];

export default function SucursalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Info');

  const { data: branch, isLoading } = useBranch(id);
  const updateBranch = useUpdateBranch(id);
  const { data: schedules = [] } = useMenuSchedules(id);
  const upsertSchedules = useUpsertMenuSchedules(id);
  const { data: menus = [] } = useMenus();
  const { data: availability = [] } = useProductAvailability(id);
  const updateAvailability = useUpdateProductAvailability(id);
  const { data: devices = [] } = useDevices();
  const approveDevice = useApproveDevice();
  const blockDevice = useBlockDevice();

  const branchDevices = devices.filter((d) => !d.branch || d.branch?.id === id);

  const [info, setInfo] = useState({ name: '', address: '', phone: '', latitude: '', longitude: '' });
  useEffect(() => {
    if (branch) {
      setInfo({
        name: branch.name,
        address: branch.address,
        phone: branch.phone ?? '',
        latitude: branch.latitude.toString(),
        longitude: branch.longitude.toString(),
      });
    }
  }, [branch]);

  if (isLoading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  if (!branch) return <div className="p-8 text-sm text-red-500">Sucursal no encontrada</div>;

  const scheduleMap = new Map(schedules.map((s) => [s.menuId, s]));

  const toggleMenuDay = async (menuId: string, day: number) => {
    const current = scheduleMap.get(menuId);
    const currentDays = current?.daysOfWeek ?? [];
    const newDays = currentDays.includes(day) ? currentDays.filter((d) => d !== day) : [...currentDays, day].sort();
    await upsertSchedules.mutateAsync([{ menuId, isActive: current?.isActive ?? true, daysOfWeek: newDays }]);
  };

  const toggleMenuActive = async (menuId: string, isActive: boolean) => {
    const current = scheduleMap.get(menuId);
    await upsertSchedules.mutateAsync([{ menuId, isActive, daysOfWeek: current?.daysOfWeek ?? [] }]);
  };

  const toggleProductAvailability = async (productId: string, isAvailable: boolean) => {
    await updateAvailability.mutateAsync([{ productId, isAvailable }]);
  };

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Sucursales</button>
      <h1 className="text-2xl font-black text-gray-900 mb-6">{branch.name}</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-[#FF6B35] text-[#FF6B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Info' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await updateBranch.mutateAsync({
              name: info.name,
              address: info.address,
              phone: info.phone || undefined,
              latitude: parseFloat(info.latitude),
              longitude: parseFloat(info.longitude),
            });
          }}
          className="flex flex-col gap-4"
        >
          {[
            { label: 'Nombre', key: 'name' as const },
            { label: 'Dirección', key: 'address' as const },
            { label: 'Teléfono', key: 'phone' as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                value={info[key]}
                onChange={(e) => setInfo((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
              />
            </div>
          ))}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">Coordenadas GPS</label>
              <button
                type="button"
                onClick={() => navigator.geolocation.getCurrentPosition((p) => setInfo((f) => ({ ...f, latitude: p.coords.latitude.toString(), longitude: p.coords.longitude.toString() })))}
                className="text-xs text-[#FF6B35] hover:underline"
              >
                Usar mi ubicación
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={info.latitude} onChange={(e) => setInfo((f) => ({ ...f, latitude: e.target.value }))} placeholder="Latitud" type="number" step="any" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]" />
              <input value={info.longitude} onChange={(e) => setInfo((f) => ({ ...f, longitude: e.target.value }))} placeholder="Longitud" type="number" step="any" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]" />
            </div>
          </div>
          <button type="submit" disabled={updateBranch.isPending} className="self-end bg-[#FF6B35] text-white rounded-lg px-6 py-2 text-sm font-bold hover:bg-[#e55a2b] disabled:opacity-50">
            {updateBranch.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      )}

      {tab === 'Menús' && (
        <div className="space-y-3">
          {menus.map((menu) => {
            const schedule = scheduleMap.get(menu.id);
            const isActive = schedule?.isActive ?? false;
            return (
              <div key={menu.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{menu.name}</p>
                    <p className="text-xs text-gray-400">{menu.type === 'FIXED' ? 'Fijo' : 'Por día'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isActive} onChange={(e) => toggleMenuActive(menu.id, e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5 bg-gray-200 peer-checked:bg-[#FF6B35] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
                {menu.type !== 'FIXED' && isActive && (
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map((d, i) => {
                      const active = schedule?.daysOfWeek?.includes(i) ?? false;
                      return (
                        <button
                          key={i}
                          onClick={() => toggleMenuDay(menu.id, i)}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${active ? 'bg-[#FF6B35] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {menus.length === 0 && <p className="text-sm text-gray-400">No hay menús configurados en este negocio.</p>}
        </div>
      )}

      {tab === 'Platillos' && (
        <div className="space-y-2">
          {availability.map((item) => (
            <div key={item.productId} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-400">{item.categoryName}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.hasOverride && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">Override</span>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.branchAvailable}
                    onChange={(e) => toggleProductAvailability(item.productId, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-checked:bg-[#FF6B35] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>
          ))}
          {availability.length === 0 && <p className="text-sm text-gray-400">No hay platillos en este negocio.</p>}
        </div>
      )}

      {tab === 'Dispositivos' && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_90px_100px_90px] px-4 py-2 bg-gray-50 border-b border-gray-200">
              {['Nombre', 'Tipo', 'Status', 'Última conexión', ''].map((h) => (
                <span key={h} className="text-[10px] font-bold text-gray-500 uppercase">{h}</span>
              ))}
            </div>
            {branchDevices.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Sin dispositivos registrados</div>
            ) : branchDevices.map((device) => (
              <div key={device.id} className="grid grid-cols-[1fr_90px_90px_100px_90px] px-4 py-3 items-center border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium text-gray-800">{device.name}</span>
                <span className="text-xs text-gray-600">{DEVICE_TYPE_LABELS[device.deviceType]}</span>
                <span className={`text-xs font-bold ${device.status === 'ACTIVE' ? 'text-green-600' : device.status === 'PENDING' ? 'text-amber-600' : 'text-red-600'}`}>
                  {DEVICE_STATUS_LABELS[device.status]}
                </span>
                <span className="text-xs text-gray-400">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleDateString('es-MX') : '—'}</span>
                <div className="flex gap-1">
                  {device.status === 'PENDING' && (
                    <button onClick={() => approveDevice.mutate({ id: device.id, branchId: id })} className="text-[11px] px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">Aprobar</button>
                  )}
                  {device.status === 'ACTIVE' && (
                    <button onClick={() => blockDevice.mutate(device.id)} className="text-[11px] px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100">Bloquear</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Agregar "Sucursales" al sidebar del admin**

En `apps/admin/src/components/layout/sidebar.tsx`, buscar el array de nav items y agregar entre Menús y Clientes:

```typescript
// Importar ícono:
import { MapPin } from 'lucide-react';

// En el array navItems, agregar:
{ href: '/sucursales', icon: MapPin, label: 'Sucursales' },
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/api/branches.ts \
        apps/admin/src/hooks/use-branches.ts \
        apps/admin/src/app/\(admin\)/sucursales/ \
        apps/admin/src/components/layout/sidebar.tsx
git commit -m "feat(admin): add Sucursales pages with 4-tab detail (info, menus, platillos, dispositivos)"
```

---

## Task 8: Admin — Liquidaciones page

**Files:**
- Create: `apps/admin/src/api/liquidations.ts`
- Create: `apps/admin/src/hooks/use-liquidations.ts`
- Create: `apps/admin/src/app/(admin)/liquidaciones/page.tsx`
- Modify: `apps/admin/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Crear api y hooks**

`apps/admin/src/api/liquidations.ts`:
```typescript
import { api } from '@/lib/api';

export interface Liquidation {
  id: string;
  amount: number;
  notes?: string;
  settledAt: string;
  branch: { name: string };
  deliveryUser: { name: string };
  receivedBy: { name: string };
}

export const getLiquidations = (branchId?: string) =>
  api.get<Liquidation[]>('/admin/liquidations', { params: branchId ? { branchId } : {} }).then((r) => r.data);

export const createLiquidation = (data: { branchId: string; receivedById: string; amount: number; notes?: string }) =>
  api.post<Liquidation>('/admin/liquidations', data).then((r) => r.data);
```

`apps/admin/src/hooks/use-liquidations.ts`:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/liquidations';

export const useLiquidations = (branchId?: string) =>
  useQuery({ queryKey: ['liquidations', branchId], queryFn: () => api.getLiquidations(branchId) });

export const useCreateLiquidation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLiquidation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liquidations'] }),
  });
};
```

- [ ] **Step 2: Crear página**

`apps/admin/src/app/(admin)/liquidaciones/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useLiquidations } from '@/hooks/use-liquidations';
import { DollarSign } from 'lucide-react';

export default function LiquidacionesPage() {
  const { data: liquidations = [], isLoading } = useLiquidations();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Liquidaciones</h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : liquidations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin liquidaciones registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_100px_80px] px-4 py-2 bg-gray-50 border-b border-gray-200">
            {['Fecha', 'Sucursal', 'Repartidor', 'Recibió', 'Monto'].map((h) => (
              <span key={h} className="text-[10px] font-bold text-gray-500 uppercase">{h}</span>
            ))}
          </div>
          {liquidations.map((liq) => (
            <div key={liq.id} className="grid grid-cols-[1fr_100px_100px_100px_80px] px-4 py-3 border-b border-gray-100 last:border-0 items-center">
              <span className="text-sm text-gray-700">{new Date(liq.settledAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="text-sm text-gray-600">{liq.branch.name}</span>
              <span className="text-sm text-gray-600">{liq.deliveryUser.name}</span>
              <span className="text-sm text-gray-600">{liq.receivedBy.name}</span>
              <span className="text-sm font-bold text-gray-900">${Number(liq.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Agregar al sidebar**

En `apps/admin/src/components/layout/sidebar.tsx`:
```typescript
import { DollarSign } from 'lucide-react';
// en navItems:
{ href: '/liquidaciones', icon: DollarSign, label: 'Liquidaciones' },
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/api/liquidations.ts \
        apps/admin/src/hooks/use-liquidations.ts \
        apps/admin/src/app/\(admin\)/liquidaciones/ \
        apps/admin/src/components/layout/sidebar.tsx
git commit -m "feat(admin): add Liquidaciones page"
```

---

## Task 9: Web QR — GPS branch picker + menú filtrado

**Files:**
- Create: `apps/web/src/components/menu/branch-picker.tsx`
- Modify: `apps/web/src/app/[slug]/page.tsx`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Agregar tipo Branch y función getBranches en api.ts**

En `apps/web/src/lib/api.ts`, agregar:

```typescript
export interface PublicBranch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
}

export async function getPublicBranches(slug: string): Promise<PublicBranch[]> {
  const res = await fetch(`${API_URL}/public/business/${slug}/branches`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  return res.json();
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortBranchesByDistance(
  branches: PublicBranch[],
  userLat: number,
  userLon: number,
): (PublicBranch & { distanceKm: number })[] {
  return branches
    .map((b) => ({ ...b, distanceKm: haversineDistance(userLat, userLon, b.latitude, b.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
```

Actualizar `getCategories` para aceptar `branchId`:
```typescript
export async function getCategories(slug: string, branchId?: string): Promise<Category[]> {
  const url = `${API_URL}/public/business/${slug}/categories${branchId ? `?branchId=${branchId}` : ''}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  return res.json();
}
```

- [ ] **Step 2: Crear BranchPicker component**

`apps/web/src/components/menu/branch-picker.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import type { PublicBranch } from '@/lib/api';
import { sortBranchesByDistance } from '@/lib/api';

interface Props {
  branches: PublicBranch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function BranchPicker({ branches, selectedId, onSelect }: Props) {
  const [sorted, setSorted] = useState<(PublicBranch & { distanceKm?: number })[]>(branches);
  const [gpsLoading, setGpsLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const result = sortBranchesByDistance(branches, pos.coords.latitude, pos.coords.longitude);
        setSorted(result);
        if (!selectedId && result.length > 0) onSelect(result[0].id);
        setGpsLoading(false);
      },
      () => {
        if (!selectedId && branches.length > 0) onSelect(branches[0].id);
        setGpsLoading(false);
      },
      { timeout: 5000 },
    );
  }, []);

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Sucursal</span>
        {gpsLoading && <span className="text-[10px] text-gray-400 ml-1">Detectando ubicación...</span>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {sorted.map((branch, i) => {
          const isNearest = i === 0 && 'distanceKm' in branch;
          const isSelected = branch.id === selectedId;
          return (
            <button
              key={branch.id}
              onClick={() => onSelect(branch.id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                isSelected
                  ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#FF6B35]'
              }`}
            >
              {branch.name}
              {isNearest && !isSelected && (
                <span className="bg-[#FF6B35] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  Más cercana
                </span>
              )}
              {'distanceKm' in branch && (
                <span className={`text-[9px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                  {(branch as any).distanceKm < 1
                    ? `${Math.round((branch as any).distanceKm * 1000)}m`
                    : `${(branch as any).distanceKm.toFixed(1)}km`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Actualizar page.tsx del web QR para usar BranchPicker**

El `[slug]/page.tsx` es un Server Component. La detección GPS requiere el cliente. Convertir el componente a usar un wrapper client-side para el picker.

Crear `apps/web/src/app/[slug]/menu-client.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { BranchPicker } from '@/components/menu/branch-picker';
import type { PublicBranch, MenuPublic } from '@/lib/api';

interface Props {
  initialMenu: MenuPublic;
  branches: PublicBranch[];
  slug: string;
}

export function MenuClient({ initialMenu, branches, slug }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    branches.length === 1 ? branches[0].id : null,
  );

  const showPicker = branches.length > 1;

  return (
    <>
      {showPicker && (
        <BranchPicker
          branches={branches}
          selectedId={selectedBranchId}
          onSelect={setSelectedBranchId}
        />
      )}
    </>
  );
}
```

En `apps/web/src/app/[slug]/page.tsx`, importar y agregar `MenuClient` y `getPublicBranches`:

```tsx
import { notFound } from 'next/navigation';
import { getBusinessMenu, getPublicBranches } from '@/lib/api';
import { BusinessHeader } from '@/components/menu/business-header';
import { ProductList } from '@/components/menu/product-list';
import { CategoryPills } from '@/components/menu/category-pills';
import { CartBar } from '@/components/cart/cart-bar';
import { MenuClient } from './menu-client';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;
  const [menu, branches] = await Promise.all([
    getBusinessMenu(slug),
    getPublicBranches(slug),
  ]);

  if (!menu) notFound();

  const { business, categories } = menu;

  return (
    <main className="min-h-screen bg-gray-50">
      <BusinessHeader business={business} />
      <MenuClient initialMenu={menu} branches={branches} slug={slug} />
      <CategoryPills categories={categories} />
      <ProductList categories={categories} slug={slug} />
      <CartBar slug={slug} />
    </main>
  );
}
```

- [ ] **Step 4: Verificar TypeScript del web**

```bash
pnpm tsc --noEmit --filter @pidefacil/web
```

Esperado: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add GPS branch picker and branch-filtered menu"
```

---

## Task 10: Mobile — device registration + OUT_FOR_DELIVERY + liquidación

**Files:**
- Create: `apps/mobile/src/screens/DevicePendingScreen.tsx`
- Create: `apps/mobile/src/api/devices.ts`
- Modify: `apps/mobile/src/api/auth.ts`
- Modify: `apps/mobile/src/constants/order-status.ts`
- Modify: `apps/mobile/app/(tabs)/pedidos/index.tsx`

- [ ] **Step 1: Agregar OUT_FOR_DELIVERY al constants/order-status.ts**

En `apps/mobile/src/constants/order-status.ts`, agregar:

```typescript
OUT_FOR_DELIVERY: {
  label: 'En camino',
  color: '#8B5CF6',
  nextStatus: 'DELIVERED',
  actionLabel: 'Marcar entregado + cobrado',
},
```

- [ ] **Step 2: Crear pantalla de dispositivo pendiente**

`apps/mobile/src/screens/DevicePendingScreen.tsx`:
```tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { Clock } from 'lucide-react-native';

export function DevicePendingScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-[#1A1A2E] px-8">
      <Clock size={48} color="#FF6B35" />
      <Text className="text-white text-xl font-black mt-4 mb-2 text-center">
        Dispositivo pendiente de aprobación
      </Text>
      <Text className="text-white/60 text-sm text-center mb-8">
        Pide al administrador que apruebe este dispositivo en el panel de PideFacil (Sucursales → Dispositivos).
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        className="bg-[#FF6B35] rounded-xl px-8 py-3"
      >
        <Text className="text-white font-bold">Ya lo aprobaron, intentar de nuevo</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 3: Crear api/devices.ts**

`apps/mobile/src/api/devices.ts`:
```typescript
import { apiClient } from './client';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import { getItem, setItem } from '../lib/secure-storage';

const DEVICE_UUID_KEY = 'device_uuid';

async function getDeviceToken(): Promise<string> {
  let uuid = await getItem(DEVICE_UUID_KEY);
  if (!uuid) {
    uuid = await Crypto.randomUUID();
    await setItem(DEVICE_UUID_KEY, uuid);
  }
  const raw = `${Device.osName ?? 'unknown'}-${Device.modelName ?? 'unknown'}-${uuid}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
}

export type DeviceRole = 'RECEPTION' | 'KITCHEN' | 'DELIVERY';

export async function registerDevice(name: string, deviceType: DeviceRole) {
  const token = await getDeviceToken();
  const { data } = await apiClient.post('/admin/devices/register', {
    name,
    deviceType,
    token,
  });
  return data as { status: 'PENDING' | 'ACTIVE' | 'BLOCKED'; deviceId: string };
}
```

- [ ] **Step 4: Modificar flujo de login para manejar DEVICE_PENDING**

En `apps/mobile/src/api/auth.ts` o donde esté el login, agregar manejo del 403 DEVICE_PENDING:

Buscar el archivo de login en mobile (probablemente `app/(auth)/login.tsx` o similar) y envolver la llamada de login con manejo de `DEVICE_PENDING`:

```typescript
// Después de un login exitoso, intentar registrar dispositivo:
try {
  const deviceResult = await registerDevice('Mi dispositivo', selectedRole);
  if (deviceResult.status === 'PENDING') {
    // Navegar a pantalla de pendiente
    router.replace('/device-pending');
    return;
  }
  if (deviceResult.status === 'BLOCKED') {
    setError('Este dispositivo está bloqueado. Contacta al administrador.');
    return;
  }
} catch {
  // Si falla el registro del dispositivo, continuar (modo sin sucursal)
}
// Navegar normalmente
router.replace('/(tabs)/pedidos');
```

- [ ] **Step 5: Agregar chip de filtro "En camino" en pantalla de pedidos**

En `apps/mobile/app/(tabs)/pedidos/index.tsx`, en el array `FILTER_CHIPS`, agregar:

```typescript
{ label: 'En camino', value: 'OUT_FOR_DELIVERY' },
```

- [ ] **Step 6: Verificar TypeScript del mobile**

```bash
pnpm tsc --noEmit --filter @pidefacil/mobile
```

Esperado: 0 errores.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/
git commit -m "feat(mobile): add device registration flow, OUT_FOR_DELIVERY status, device pending screen"
```

---

## Task 11: Planes en Super Admin — agregar maxDevices

**Files:**
- Modify: `apps/admin/src/app/(super)/super/planes/page.tsx`
- Modify: `apps/admin/src/api/super-admin.ts`
- Modify: `apps/admin/src/hooks/use-super-admin.ts`

- [ ] **Step 1: Actualizar SaPlan interface**

En `apps/admin/src/api/super-admin.ts`, agregar `maxDevices` a la interface `SaPlan`:

```typescript
export interface SaPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  maxUsers: number;
  maxProducts: number;
  maxBranches: number;
  maxDevices: number;
}
```

- [ ] **Step 2: Actualizar tabla de planes para mostrar y editar maxDevices**

En `apps/admin/src/app/(super)/super/planes/page.tsx`:

Cambiar la constante `COLS` y el header para incluir Dispositivos:
```typescript
const COLS = 'grid-cols-[140px_80px_70px_80px_80px_80px_110px]';
// header:
{['Nombre', 'Precio/mes', 'Usuarios', 'Productos', 'Sucursales', 'Dispositivos', ''].map(...)}
```

Agregar campo `maxDevices` en `EMPTY_ROW`:
```typescript
const EMPTY_ROW: EditRow = { name: '', monthlyPrice: 0, maxUsers: 1, maxProducts: 1, maxBranches: 1, maxDevices: 4 };
```

Agregar input para `maxDevices` en el formulario de edición y creación junto a los demás campos numéricos.

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit --filter @pidefacil/admin
```

Esperado: 0 errores.

- [ ] **Step 4: Ejecutar todos los tests**

```bash
cd apps/api && pnpm test
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Push final**

```bash
git add apps/admin/src/app/\(super\)/super/planes/page.tsx apps/admin/src/api/super-admin.ts
git commit -m "feat(super): add maxDevices field to plans table"
git push origin main
```

Esperado: GitHub Actions corre tests y despliega en Coolify automáticamente.

---

## Resumen de archivos creados/modificados

### API (apps/api)
| Acción | Archivo |
|--------|---------|
| Create | `src/branches/branches.module.ts` |
| Create | `src/branches/branches.service.ts` |
| Create | `src/branches/branches.controller.ts` |
| Create | `src/branches/dto/*.ts` (4 archivos) |
| Create | `src/branches/branches.integration.spec.ts` |
| Create | `src/devices/devices.module.ts` |
| Create | `src/devices/devices.service.ts` |
| Create | `src/devices/devices.controller.ts` |
| Create | `src/devices/dto/*.ts` (2 archivos) |
| Create | `src/devices/devices.integration.spec.ts` |
| Create | `src/liquidations/liquidations.module.ts` |
| Create | `src/liquidations/liquidations.service.ts` |
| Create | `src/liquidations/liquidations.controller.ts` |
| Create | `src/liquidations/dto/create-liquidation.dto.ts` |
| Modify | `prisma/schema.prisma` |
| Modify | `src/app.module.ts` |
| Modify | `src/orders/orders.service.ts` |
| Modify | `src/orders/orders.controller.ts` |
| Modify | `src/orders/dto/create-order.dto.ts` |
| Modify | `src/public/public.service.ts` |
| Modify | `src/public/public.controller.ts` |
| Modify | All `*.integration.spec.ts` files (cleanup) |

### Admin (apps/admin)
| Acción | Archivo |
|--------|---------|
| Create | `src/api/branches.ts` |
| Create | `src/api/liquidations.ts` |
| Create | `src/hooks/use-branches.ts` |
| Create | `src/hooks/use-liquidations.ts` |
| Create | `src/app/(admin)/sucursales/page.tsx` |
| Create | `src/app/(admin)/sucursales/nueva/page.tsx` |
| Create | `src/app/(admin)/sucursales/[id]/page.tsx` |
| Create | `src/app/(admin)/liquidaciones/page.tsx` |
| Modify | `src/components/layout/sidebar.tsx` |
| Modify | `src/app/(super)/super/planes/page.tsx` |
| Modify | `src/api/super-admin.ts` |

### Web (apps/web)
| Acción | Archivo |
|--------|---------|
| Create | `src/components/menu/branch-picker.tsx` |
| Create | `src/app/[slug]/menu-client.tsx` |
| Modify | `src/lib/api.ts` |
| Modify | `src/app/[slug]/page.tsx` |

### Mobile (apps/mobile)
| Acción | Archivo |
|--------|---------|
| Create | `src/screens/DevicePendingScreen.tsx` |
| Create | `src/api/devices.ts` |
| Modify | `src/constants/order-status.ts` |
| Modify | `app/(tabs)/pedidos/index.tsx` |
