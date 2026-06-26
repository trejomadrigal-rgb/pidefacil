# Formas de Pago Configurables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada negocio configure su catálogo de formas de pago (texto libre + flag `requiresConfirmation`), y que el cliente seleccione una al ordenar en el menú QR.

**Architecture:** Nueva tabla `BusinessPaymentMethod` con catálogo por negocio. `Order` guarda `paymentMethodId` (FK) y `paymentMethodLabel` (snapshot). La lógica de confirmación de pago antes de delivery usa el nuevo flag `requiresConfirmation` en lugar del check hardcodeado `paymentMethod !== CASH`.

**Tech Stack:** NestJS + Prisma (API), Next.js App Router (web + admin), React Native Reanimated (mobile), TanStack Query (admin + mobile), React Hook Form + Zod (web checkout).

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `apps/api/prisma/schema.prisma` | Crear modelo `BusinessPaymentMethod` + 2 campos en `Order` + relación en `Business` |
| `apps/api/prisma/migrations/` | Migración generada con `npx prisma migrate dev` |
| `apps/api/src/payment-methods/payment-methods.module.ts` | Crear |
| `apps/api/src/payment-methods/payment-methods.service.ts` | Crear |
| `apps/api/src/payment-methods/payment-methods.controller.ts` | Crear |
| `apps/api/src/payment-methods/dto/create-payment-method.dto.ts` | Crear |
| `apps/api/src/payment-methods/dto/update-payment-method.dto.ts` | Crear |
| `apps/api/src/app.module.ts` | Importar `PaymentMethodsModule` |
| `apps/api/src/public/public.controller.ts` | Agregar `GET :slug/payment-methods` |
| `apps/api/src/public/public.service.ts` | Agregar `getPaymentMethods(slug)` |
| `apps/api/src/orders/dto/create-order.dto.ts` | Agregar `paymentMethodId?: string` |
| `apps/api/src/orders/orders.service.ts` | Ajustar `create`, `updateStatus`, `confirmTransfer`, `getOrderDetail` |
| `apps/api/src/whatsapp/whatsapp.service.ts` | Usar `paymentMethodLabel` + `requiresConfirmation` |
| `apps/admin/src/api/payment-methods.ts` | Crear |
| `apps/admin/src/hooks/use-payment-methods.ts` | Crear |
| `apps/admin/src/components/settings/payment-methods-section.tsx` | Crear |
| `apps/admin/src/app/(admin)/settings/page.tsx` | Incluir `PaymentMethodsSection` |
| `apps/web/src/lib/api.ts` | Agregar `getPaymentMethods()` + campo en `CreateOrderPayload` |
| `apps/web/src/app/[slug]/checkout/page.tsx` | Fetch + pasar `paymentMethods` al form |
| `apps/web/src/components/checkout/checkout-form.tsx` | Selector de forma de pago |
| `apps/mobile/src/api/orders.ts` | Agregar campos al tipo `OrderDetail` |
| `apps/mobile/app/(tabs)/pedidos/[id].tsx` | Mostrar `paymentMethodLabel` + badge pago pendiente |

---

## Task 1: Prisma schema — nueva tabla y campos

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Agregar modelo `BusinessPaymentMethod` al schema**

Abre `apps/api/prisma/schema.prisma`. Agrega al final del archivo (antes del último cierre si hay alguno, o simplemente al final):

```prisma
model BusinessPaymentMethod {
  id                   String   @id @default(cuid())
  businessId           String
  label                String
  requiresConfirmation Boolean  @default(false)
  isActive             Boolean  @default(true)
  position             Int      @default(0)
  createdAt            DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  orders   Order[]
}
```

- [ ] **Step 2: Agregar relación inversa en `Business`**

En el modelo `Business`, después de la línea `shifts Shift[]`, agrega:

```prisma
  paymentMethods BusinessPaymentMethod[]
```

- [ ] **Step 3: Agregar campos en `Order`**

En el modelo `Order`, después de la línea `liquidationId String?`, agrega:

```prisma
  paymentMethodId    String?
  paymentMethodLabel String?
```

En el bloque de relaciones de `Order`, después de `liquidation Liquidation?`, agrega:

```prisma
  customPaymentMethod BusinessPaymentMethod? @relation(fields: [paymentMethodId], references: [id], onDelete: SetNull)
```

- [ ] **Step 4: Generar y aplicar la migración**

```bash
cd apps/api
npx prisma migrate dev --name add_business_payment_methods
```

Salida esperada: `Your database is now in sync with your schema.`

- [ ] **Step 5: Regenerar el cliente de Prisma**

```bash
cd apps/api
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add BusinessPaymentMethod table and Order payment fields"
```

---

## Task 2: Módulo PaymentMethods en la API

**Files:**
- Create: `apps/api/src/payment-methods/dto/create-payment-method.dto.ts`
- Create: `apps/api/src/payment-methods/dto/update-payment-method.dto.ts`
- Create: `apps/api/src/payment-methods/payment-methods.service.ts`
- Create: `apps/api/src/payment-methods/payment-methods.controller.ts`
- Create: `apps/api/src/payment-methods/payment-methods.module.ts`

- [ ] **Step 1: Crear `create-payment-method.dto.ts`**

```typescript
// apps/api/src/payment-methods/dto/create-payment-method.dto.ts
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;

  @IsBoolean()
  @IsOptional()
  requiresConfirmation?: boolean;

  @IsInt()
  @IsOptional()
  position?: number;
}
```

- [ ] **Step 2: Crear `update-payment-method.dto.ts`**

```typescript
// apps/api/src/payment-methods/dto/update-payment-method.dto.ts
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePaymentMethodDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  requiresConfirmation?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  position?: number;
}
```

- [ ] **Step 3: Crear `payment-methods.service.ts`**

```typescript
// apps/api/src/payment-methods/payment-methods.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.businessPaymentMethod.findMany({
      where: { businessId },
      orderBy: { position: 'asc' },
    });
  }

  async listPublic(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) return [];

    return this.prisma.businessPaymentMethod.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true, label: true, requiresConfirmation: true },
    });
  }

  async create(businessId: string, dto: CreatePaymentMethodDto) {
    const maxPos = await this.prisma.businessPaymentMethod.aggregate({
      where: { businessId },
      _max: { position: true },
    });
    const position = dto.position ?? (maxPos._max.position ?? -1) + 1;

    return this.prisma.businessPaymentMethod.create({
      data: {
        businessId,
        label: dto.label,
        requiresConfirmation: dto.requiresConfirmation ?? false,
        position,
      },
    });
  }

  async update(businessId: string, id: string, dto: UpdatePaymentMethodDto) {
    const existing = await this.prisma.businessPaymentMethod.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Forma de pago no encontrada');

    return this.prisma.businessPaymentMethod.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.requiresConfirmation !== undefined && { requiresConfirmation: dto.requiresConfirmation }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });
  }

  async remove(businessId: string, id: string) {
    const existing = await this.prisma.businessPaymentMethod.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Forma de pago no encontrada');

    const ordersCount = await this.prisma.order.count({ where: { paymentMethodId: id } });
    if (ordersCount > 0) {
      throw new ConflictException(
        'Esta forma de pago tiene pedidos asociados. Desactívala en lugar de eliminarla.',
      );
    }

    await this.prisma.businessPaymentMethod.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Crear `payment-methods.controller.ts`**

```typescript
// apps/api/src/payment-methods/payment-methods.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('admin/payment-methods')
@Roles(Role.OWNER, Role.ADMIN)
export class PaymentMethodsController {
  constructor(private service: PaymentMethodsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.list(user.businessId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreatePaymentMethodDto) {
    return this.service.create(user.businessId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.service.update(user.businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.remove(user.businessId, id);
  }
}
```

- [ ] **Step 5: Crear `payment-methods.module.ts`**

```typescript
// apps/api/src/payment-methods/payment-methods.module.ts
import { Module } from '@nestjs/common';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
```

- [ ] **Step 6: Registrar en `app.module.ts`**

En `apps/api/src/app.module.ts`, agrega el import al principio del archivo:

```typescript
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
```

Dentro del array `imports: [...]` del decorador `@Module`, agrega `PaymentMethodsModule` junto a los otros módulos (ej: después de `UsersModule`).

- [ ] **Step 7: Verificar que compila**

```bash
cd apps/api
npx tsc --noEmit
```

Salida esperada: sin errores.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/payment-methods/ apps/api/src/app.module.ts
git commit -m "feat(api): add PaymentMethods module (CRUD admin + public list)"
```

---

## Task 3: Endpoint público GET /public/business/:slug/payment-methods

**Files:**
- Modify: `apps/api/src/public/public.controller.ts`
- Modify: `apps/api/src/public/public.service.ts`
- Modify: `apps/api/src/public/public.module.ts`

- [ ] **Step 1: Agregar método en `public.service.ts`**

En `apps/api/src/public/public.service.ts`, agrega al final de la clase (antes del cierre `}`):

```typescript
async getPaymentMethods(slug: string) {
  const business = await this.prisma.business.findUnique({ where: { slug } });
  if (!business) return [];

  return this.prisma.businessPaymentMethod.findMany({
    where: { businessId: business.id, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, label: true, requiresConfirmation: true },
  });
}
```

- [ ] **Step 2: Agregar endpoint en `public.controller.ts`**

En `apps/api/src/public/public.controller.ts`, agrega después del método `getOrdersByPhone`:

```typescript
@Get(':slug/payment-methods')
getPaymentMethods(@Param('slug') slug: string) {
  return this.publicService.getPaymentMethods(slug);
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd apps/api
npx tsc --noEmit
```

- [ ] **Step 4: Probar el endpoint manualmente**

Si el API está corriendo localmente:

```bash
curl http://localhost:3000/public/business/dona-rosa/payment-methods
```

Salida esperada: `[]` (array vacío, ya que aún no hay métodos configurados).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/public/
git commit -m "feat(api): add GET /public/business/:slug/payment-methods endpoint"
```

---

## Task 4: Modificar create order — validar y guardar forma de pago

**Files:**
- Modify: `apps/api/src/orders/dto/create-order.dto.ts`
- Modify: `apps/api/src/orders/orders.service.ts`

- [ ] **Step 1: Agregar `paymentMethodId` al DTO**

En `apps/api/src/orders/dto/create-order.dto.ts`, agrega antes del campo `items`:

```typescript
@IsOptional()
@IsString()
paymentMethodId?: string;
```

Asegúrate de que `IsString` ya está importado desde `class-validator` (sí está).

- [ ] **Step 2: Modificar `create()` en `orders.service.ts` — validar forma de pago**

En `apps/api/src/orders/orders.service.ts`, dentro del método `create()`, ANTES de la transacción Prisma (antes de `return this.prisma.$transaction(...)`), agrega:

```typescript
// Validate payment method if business has any active methods
const activeMethodsCount = await this.prisma.businessPaymentMethod.count({
  where: { businessId: dto.businessId, isActive: true },
});

let resolvedPaymentMethod: { id: string; label: string } | null = null;

if (activeMethodsCount > 0) {
  if (!dto.paymentMethodId) {
    throw new BadRequestException('Selecciona una forma de pago para continuar');
  }
  resolvedPaymentMethod = await this.prisma.businessPaymentMethod.findFirst({
    where: { id: dto.paymentMethodId, businessId: dto.businessId, isActive: true },
    select: { id: true, label: true },
  });
  if (!resolvedPaymentMethod) {
    throw new BadRequestException('Forma de pago no válida');
  }
}
```

Asegúrate de que `BadRequestException` ya está importado desde `@nestjs/common` (sí está).

- [ ] **Step 3: Pasar los campos al `tx.order.create()`**

Dentro de la transacción, en el bloque `data: { ... }` de `tx.order.create(...)`, reemplaza la línea:

```typescript
paymentMethod: dto.paymentMethod ?? null,
```

Por:

```typescript
paymentMethod: dto.paymentMethod ?? null,
paymentMethodId: resolvedPaymentMethod?.id ?? null,
paymentMethodLabel: resolvedPaymentMethod?.label ?? null,
```

- [ ] **Step 4: Verificar que compila**

```bash
cd apps/api
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders/dto/create-order.dto.ts apps/api/src/orders/orders.service.ts
git commit -m "feat(orders): validate and snapshot paymentMethod on order creation"
```

---

## Task 5: Modificar updateStatus y confirmTransfer — usar requiresConfirmation

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts`

- [ ] **Step 1: Actualizar `updateStatus()` — incluir relación y cambiar check**

En el método `updateStatus()`, el `findFirst` actual es:

```typescript
const order = await this.prisma.order.findFirst({ where: { id, businessId } });
```

Cámbialo a:

```typescript
const order = await this.prisma.order.findFirst({
  where: { id, businessId },
  include: { customPaymentMethod: { select: { requiresConfirmation: true } } },
});
```

Luego, cambia la validación de delivery (actualmente en la línea que tiene `paymentMethod !== PaymentMethod.CASH`):

```typescript
// ANTES:
if (order.paymentMethod !== PaymentMethod.CASH && !order.isPaid) {

// DESPUÉS:
if (order.customPaymentMethod?.requiresConfirmation && !order.isPaid) {
```

- [ ] **Step 2: Actualizar `confirmTransfer()` — cambiar validación de TRANSFER a requiresConfirmation**

El método `confirmTransfer()` actualmente tiene:

```typescript
const order = await this.prisma.order.findFirst({
  where: { id: orderId, businessId, paymentMethod: 'TRANSFER' },
});
if (!order) throw new NotFoundException('Pedido no encontrado');
```

Cámbialo por:

```typescript
const order = await this.prisma.order.findFirst({
  where: { id: orderId, businessId },
  include: { customPaymentMethod: { select: { requiresConfirmation: true } } },
});
if (!order) throw new NotFoundException('Pedido no encontrado');
if (!order.customPaymentMethod?.requiresConfirmation) {
  throw new BadRequestException('Esta forma de pago no requiere confirmación de pago');
}
```

- [ ] **Step 3: Actualizar `getOrderDetail()` — incluir nuevos campos en el response**

El método que inicia en `const order = await this.prisma.order.findFirst({ where: { id, businessId }, include: { items: ...` (línea ~78).

Agrega `customPaymentMethod` al `include`:

```typescript
const order = await this.prisma.order.findFirst({
  where: { id, businessId },
  include: {
    items: { include: { product: { select: { name: true } } } },
    customer: { select: { id: true, name: true, phone: true, notes: true, trustLevel: true } },
    customPaymentMethod: { select: { requiresConfirmation: true } },
  },
});
```

En el objeto retornado, agrega después de `createdAt: order.createdAt`:

```typescript
paymentMethodLabel: order.paymentMethodLabel ?? null,
isPaid: order.isPaid,
customPaymentMethod: order.customPaymentMethod
  ? { requiresConfirmation: order.customPaymentMethod.requiresConfirmation }
  : null,
```

- [ ] **Step 4: Verificar que compila**

```bash
cd apps/api
npx tsc --noEmit
```

- [ ] **Step 4: Actualizar `getStatus()` — agregar paymentMethodLabel y requiresConfirmation al response público**

En `orders.service.ts`, el método `getStatus()` (el que usa la página web de seguimiento del pedido) tiene un `select` con `paymentMethod: true`. Agrégale:

```typescript
// En el select del findFirst de getStatus():
paymentMethodLabel: true,
customPaymentMethod: { select: { requiresConfirmation: true } },
```

Y en el objeto retornado, después de `transferConfirmed: order.transferConfirmed`:

```typescript
paymentMethodLabel: order.paymentMethodLabel ?? null,
requiresConfirmation: order.customPaymentMethod?.requiresConfirmation ?? false,
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders/orders.service.ts
git commit -m "feat(orders): replace CASH hardcode with requiresConfirmation flag"
```

---

## Task 6: Modificar whatsapp.service.ts — usar paymentMethodLabel

**Files:**
- Modify: `apps/api/src/whatsapp/whatsapp.service.ts`

- [ ] **Step 1: Actualizar `buildConfirmedMessage()` — firma y cuerpo**

La función `buildConfirmedMessage` actualmente recibe `paymentMethod: string | null`. Cámbiala completa:

```typescript
function buildConfirmedMessage(
  folio: string,
  name: string,
  business: string,
  items: { name: string; quantity: number; price: number }[],
  total: number,
  paymentMethodLabel: string | null,
  requiresConfirmation: boolean,
): string {
  const itemLines = items
    .map((i) => `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}`)
    .join('\n');

  const payLine = paymentMethodLabel ? `\n💳 *Pago:* ${paymentMethodLabel}` : '';

  const transferNote = requiresConfirmation
    ? '\n\n⚠️ *Importante:* Tu pedido pasará a preparación una vez que nos envíes el comprobante de pago. Sin comprobante no iniciaremos la preparación.'
    : '\n\nYa lo estamos preparando. 🍳';

  return (
    `✅ *Pedido #${folio} confirmado*\n\n` +
    `¡Hola ${name}! Tu pedido en *${business}* fue recibido.\n\n` +
    `🛒 *Tu pedido:*\n${itemLines}\n\n` +
    `💰 *Total: $${total.toFixed(2)}*${payLine}` +
    transferNote
  );
}
```

También puedes eliminar el objeto `PAYMENT_LABEL` ya que ya no se usa.

- [ ] **Step 2: Actualizar `sendStatusMessage()` — fetch con nuevos campos**

En el método `sendStatusMessage()`, el fetch del pedido completo actualmente tiene:

```typescript
const fullOrder = await this.prisma.order.findFirst({
  where: { businessId: order.businessId, orderNumber: order.orderNumber },
  select: {
    total: true,
    paymentMethod: true,
    items: { select: { quantity: true, price: true, product: { select: { name: true } } } },
  },
});
```

Cámbialo a:

```typescript
const fullOrder = await this.prisma.order.findFirst({
  where: { businessId: order.businessId, orderNumber: order.orderNumber },
  select: {
    total: true,
    paymentMethodLabel: true,
    customPaymentMethod: { select: { requiresConfirmation: true } },
    items: { select: { quantity: true, price: true, product: { select: { name: true } } } },
  },
});
```

Y actualiza la llamada a `buildConfirmedMessage`:

```typescript
text = buildConfirmedMessage(
  order.orderNumber,
  order.customerName,
  biz.name,
  items,
  Number(fullOrder?.total ?? 0),
  fullOrder?.paymentMethodLabel ?? null,
  fullOrder?.customPaymentMethod?.requiresConfirmation ?? false,
);
```

- [ ] **Step 3: Verificar que compila**

```bash
cd apps/api
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/whatsapp/whatsapp.service.ts
git commit -m "feat(whatsapp): use paymentMethodLabel and requiresConfirmation in messages"
```

---

## Task 7: Admin — API client y hooks de formas de pago

**Files:**
- Create: `apps/admin/src/api/payment-methods.ts`
- Create: `apps/admin/src/hooks/use-payment-methods.ts`

- [ ] **Step 1: Crear `apps/admin/src/api/payment-methods.ts`**

```typescript
import { api } from '@/lib/api';

export interface BusinessPaymentMethod {
  id: string;
  label: string;
  requiresConfirmation: boolean;
  isActive: boolean;
  position: number;
  createdAt: string;
}

export const getPaymentMethods = () =>
  api.get<BusinessPaymentMethod[]>('/admin/payment-methods').then((r) => r.data);

export const createPaymentMethod = (data: { label: string; requiresConfirmation: boolean }) =>
  api.post<BusinessPaymentMethod>('/admin/payment-methods', data).then((r) => r.data);

export const updatePaymentMethod = (
  id: string,
  data: Partial<{ label: string; requiresConfirmation: boolean; isActive: boolean }>,
) => api.patch<BusinessPaymentMethod>(`/admin/payment-methods/${id}`, data).then((r) => r.data);

export const deletePaymentMethod = (id: string) =>
  api.delete(`/admin/payment-methods/${id}`);
```

- [ ] **Step 2: Crear `apps/admin/src/hooks/use-payment-methods.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  type BusinessPaymentMethod,
} from '@/api/payment-methods';

const QK = ['payment-methods'];

export const usePaymentMethods = () =>
  useQuery({ queryKey: QK, queryFn: getPaymentMethods });

export const useCreatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useUpdatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<BusinessPaymentMethod, 'label' | 'requiresConfirmation' | 'isActive'>>;
    }) => updatePaymentMethod(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useDeletePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/api/payment-methods.ts apps/admin/src/hooks/use-payment-methods.ts
git commit -m "feat(admin): add payment-methods API client and hooks"
```

---

## Task 8: Admin — componente PaymentMethodsSection

**Files:**
- Create: `apps/admin/src/components/settings/payment-methods-section.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// apps/admin/src/components/settings/payment-methods-section.tsx
'use client';

import { useState } from 'react';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from '@/hooks/use-payment-methods';
import type { BusinessPaymentMethod } from '@/api/payment-methods';

function AddForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState('');
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const create = useCreatePaymentMethod();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    await create.mutateAsync({ label: label.trim(), requiresConfirmation });
    setLabel('');
    setRequiresConfirmation(false);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-gray-50 rounded-xl space-y-3">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Ej: Clip, Efectivo, Transferencia BBVA"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        maxLength={60}
        autoFocus
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={requiresConfirmation}
          onChange={(e) => setRequiresConfirmation(e.target.checked)}
          className="accent-brand-500"
        />
        Requiere confirmar pago antes de preparar
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-2 text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!label.trim() || create.isPending}
          className="flex-1 bg-brand-500 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          {create.isPending ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
    </form>
  );
}

function EditForm({ method, onDone }: { method: BusinessPaymentMethod; onDone: () => void }) {
  const [label, setLabel] = useState(method.label);
  const [requiresConfirmation, setRequiresConfirmation] = useState(method.requiresConfirmation);
  const update = useUpdatePaymentMethod();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    await update.mutateAsync({ id: method.id, data: { label: label.trim(), requiresConfirmation } });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 bg-gray-50 rounded-xl space-y-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        maxLength={60}
        autoFocus
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={requiresConfirmation}
          onChange={(e) => setRequiresConfirmation(e.target.checked)}
          className="accent-brand-500"
        />
        Requiere confirmar pago
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-1.5 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={!label.trim() || update.isPending} className="flex-1 bg-brand-500 text-white rounded-lg py-1.5 text-sm font-semibold disabled:opacity-50">
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function MethodRow({ method }: { method: BusinessPaymentMethod }) {
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const update = useUpdatePaymentMethod();
  const remove = useDeletePaymentMethod();

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await remove.mutateAsync(method.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message.includes('409')
          ? 'Tiene pedidos asociados. Desactívala en lugar de eliminarla.'
          : 'No se pudo eliminar.';
      setDeleteError(msg);
    }
  };

  const handleToggle = () => {
    update.mutate({ id: method.id, data: { isActive: !method.isActive } });
  };

  return (
    <div className="py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${method.isActive ? 'bg-brand-500' : 'bg-gray-200'}`}
          aria-label={method.isActive ? 'Desactivar' : 'Activar'}
        >
          <span
            className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${method.isActive ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
        <span className={`flex-1 text-sm font-medium ${method.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
          {method.label}
        </span>
        {method.requiresConfirmation && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ confirmar</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="text-gray-400 hover:text-brand-500 text-xs px-1"
          aria-label="Editar"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={remove.isPending}
          className="text-gray-400 hover:text-red-500 text-xs px-1 disabled:opacity-50"
          aria-label="Eliminar"
        >
          🗑️
        </button>
      </div>
      {deleteError && <p className="text-xs text-red-500 mt-1 ml-12">{deleteError}</p>}
      {editing && <EditForm method={method} onDone={() => setEditing(false)} />}
    </div>
  );
}

export function PaymentMethodsSection() {
  const { data: methods = [], isLoading } = usePaymentMethods();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mt-6">
      <h2 className="font-jakarta font-bold text-brand-900 text-base mb-1">Formas de pago</h2>
      <p className="text-xs text-gray-400 mb-4">
        Define qué métodos acepta tu negocio. Solo los activos aparecerán en el menú.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : methods.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-400">Sin formas de pago configuradas.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {methods.map((m) => (
            <MethodRow key={m.id} method={m} />
          ))}
        </div>
      )}

      {showAdd ? (
        <AddForm onDone={() => setShowAdd(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-4 text-sm text-brand-500 font-semibold hover:text-brand-700 transition-colors"
        >
          + Agregar forma de pago
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/components/settings/payment-methods-section.tsx
git commit -m "feat(admin): add PaymentMethodsSection component for settings"
```

---

## Task 9: Admin — agregar sección a Settings page

**Files:**
- Modify: `apps/admin/src/app/(admin)/settings/page.tsx`

- [ ] **Step 1: Actualizar `settings/page.tsx`**

El archivo actual es:

```typescript
import { BusinessForm } from '@/components/settings/business-form';

export default function SettingsPage() {
  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="font-jakarta font-bold text-brand-900 text-xl">Configuración</h1>
        <p className="text-sm text-gray-400 mt-1">Gestiona la información de tu negocio</p>
      </div>
      <BusinessForm />
    </div>
  );
}
```

Reemplázalo por:

```typescript
import { BusinessForm } from '@/components/settings/business-form';
import { PaymentMethodsSection } from '@/components/settings/payment-methods-section';

export default function SettingsPage() {
  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="font-jakarta font-bold text-brand-900 text-xl">Configuración</h1>
        <p className="text-sm text-gray-400 mt-1">Gestiona la información de tu negocio</p>
      </div>
      <BusinessForm />
      <PaymentMethodsSection />
    </div>
  );
}
```

- [ ] **Step 2: Verificar que el admin compila**

```bash
cd apps/admin
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(admin\)/settings/page.tsx
git commit -m "feat(admin): add PaymentMethodsSection to settings page"
```

---

## Task 10: Web — fetch de formas de pago + selector en checkout

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/[slug]/checkout/page.tsx`
- Modify: `apps/web/src/components/checkout/checkout-form.tsx`

- [ ] **Step 1: Agregar tipos y función en `apps/web/src/lib/api.ts`**

Agrega antes de la función `createOrder`:

```typescript
export interface PublicPaymentMethod {
  id: string;
  label: string;
  requiresConfirmation: boolean;
}

export async function getPaymentMethods(slug: string): Promise<PublicPaymentMethod[]> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}/payment-methods`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
```

En la interfaz `CreateOrderPayload`, agrega:

```typescript
paymentMethodId?: string;
```

- [ ] **Step 2: Actualizar `checkout/page.tsx` — fetch y paso de paymentMethods**

El `CheckoutFormWrapper` actual obtiene el negocio con `getBusiness`. Cámbialo para obtener también los métodos de pago:

```typescript
// Agrega el import al inicio del archivo:
import { getBusiness, getPaymentMethods, type BusinessPublic, type PublicPaymentMethod } from '@/lib/api';
```

Reemplaza la función `CheckoutFormWrapper`:

```typescript
function CheckoutFormWrapper({ slug, onSubmitted }: { slug: string; onSubmitted: () => void }) {
  const [business, setBusiness] = useState<BusinessPublic | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);

  useEffect(() => {
    Promise.all([getBusiness(slug), getPaymentMethods(slug)])
      .then(([b, pm]) => {
        setBusiness(b);
        setPaymentMethods(pm);
      })
      .catch(() => {});
  }, [slug]);

  if (!business) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <CheckoutForm
      slug={slug}
      businessId={business.id}
      businessPhone={business.phone}
      paymentMethods={paymentMethods}
      onSubmitted={onSubmitted}
    />
  );
}
```

- [ ] **Step 3: Actualizar `checkout-form.tsx` — agregar prop y selector**

**3a — Agregar `paymentMethods` a la interfaz de props:**

```typescript
interface CheckoutFormProps {
  slug: string;
  businessId: string;
  businessPhone?: string;
  paymentMethods: PublicPaymentMethod[];
  onSubmitted?: () => void;
}
```

Agrega el import al inicio:

```typescript
import type { PublicPaymentMethod } from '@/lib/api';
```

**3b — Agregar `paymentMethodId` al schema Zod:**

Dentro del objeto `z.object({ ... })`, agrega:

```typescript
paymentMethodId: z.string().optional(),
```

**3c — Agregar estado local para el método seleccionado:**

Dentro del componente `CheckoutForm`, agrega después del estado `errorMsg`:

```typescript
const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
```

**3d — Validar método de pago en `onSubmit`:**

Al inicio de `onSubmit`, antes de llamar a `createOrder`, agrega:

```typescript
if (paymentMethods.length > 0 && !selectedPaymentMethodId) {
  setErrorMsg('Selecciona una forma de pago para continuar');
  return;
}
```

**3e — Agregar `paymentMethodId` al payload de `createOrder`:**

En la llamada a `createOrder({ ... })`, agrega:

```typescript
paymentMethodId: selectedPaymentMethodId || undefined,
```

**3f — Agregar el selector en el JSX, ANTES del bloque de notas:**

Antes del bloque `{/* Notes */}`, agrega:

```typescript
{/* Payment method */}
{paymentMethods.length > 0 && (
  <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
    <h2 className="font-bold text-brand-900 mb-3">¿Cómo vas a pagar?</h2>
    <div className="space-y-2">
      {paymentMethods.map((method) => (
        <label
          key={method.id}
          className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
            selectedPaymentMethodId === method.id
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-100 hover:border-gray-200'
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value={method.id}
            checked={selectedPaymentMethodId === method.id}
            onChange={() => setSelectedPaymentMethodId(method.id)}
            className="sr-only"
          />
          <div
            className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
              selectedPaymentMethodId === method.id
                ? 'border-brand-500 bg-brand-500'
                : 'border-gray-300'
            }`}
          />
          <div>
            <p className={`text-sm font-semibold ${selectedPaymentMethodId === method.id ? 'text-brand-900' : 'text-gray-700'}`}>
              {method.label}
            </p>
            {method.requiresConfirmation && (
              <p className="text-xs text-amber-600 mt-0.5">
                Se te pedirá comprobante antes de preparar tu pedido
              </p>
            )}
          </div>
        </label>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Actualizar `OrderStatusResponse` en `apps/web/src/lib/api.ts`**

La interfaz `OrderStatusResponse` (usada por la página de seguimiento del pedido) actualmente tiene `paymentMethod: string | null` y `transferConfirmed: boolean`. Agrega:

```typescript
paymentMethodLabel: string | null;
requiresConfirmation: boolean;
```

- [ ] **Step 5: Actualizar el banner de pago pendiente en `apps/web/src/components/order/order-status.tsx`**

El componente actualmente muestra el banner de pago pendiente con:

```typescript
{order.paymentMethod === 'TRANSFER' && !order.transferConfirmed && !isTerminal && (
```

Esto siempre será false para pedidos nuevos (paymentMethod es null). Reemplaza esa condición por:

```typescript
{order.requiresConfirmation && !order.transferConfirmed && !isTerminal && (
```

- [ ] **Step 6: Verificar que el web compila**

```bash
cd apps/web
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/\[slug\]/checkout/page.tsx apps/web/src/components/checkout/checkout-form.tsx apps/web/src/components/order/order-status.tsx
git commit -m "feat(web): add payment method selector and fix requiresConfirmation banner"
```

---

## Task 11: Mobile — tipos y UI del detalle de pedido

**Files:**
- Modify: `apps/mobile/src/api/orders.ts`
- Modify: `apps/mobile/app/(tabs)/pedidos/[id].tsx`

- [ ] **Step 1: Agregar campos al tipo `OrderDetail` en `apps/mobile/src/api/orders.ts`**

En la interfaz `OrderDetail`, agrega después de `createdAt: string`:

```typescript
paymentMethodLabel: string | null;
isPaid: boolean;
customPaymentMethod: { requiresConfirmation: boolean } | null;
```

- [ ] **Step 2: Actualizar el detalle del pedido en `apps/mobile/app/(tabs)/pedidos/[id].tsx`**

En la sección de "Cliente" (el primer `Animated.View` dentro de `<View className="px-4 pt-4">`), hay información del cliente y tipo de entrega. Agrega la forma de pago después de esa sección.

Después del bloque `{/* Items */}`, agrega un nuevo bloque:

```typescript
{/* Forma de pago */}
{(order.paymentMethodLabel || order.customPaymentMethod) && (
  <Animated.View entering={FadeInDown.delay(200).springify().damping(18)} className="bg-white rounded-2xl p-4 mb-3">
    <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">Forma de pago</Text>
    <View className="flex-row items-center justify-between">
      <Text className="text-gray-900 font-medium text-sm">
        {order.paymentMethodLabel ?? '—'}
      </Text>
      {order.customPaymentMethod?.requiresConfirmation && !order.isPaid && (
        <View className="bg-amber-100 rounded-full px-2 py-0.5">
          <Text className="text-amber-700 text-xs font-bold">⏳ Pago pendiente</Text>
        </View>
      )}
      {order.isPaid && (
        <View className="bg-green-100 rounded-full px-2 py-0.5">
          <Text className="text-green-700 text-xs font-bold">✅ Pagado</Text>
        </View>
      )}
    </View>
  </Animated.View>
)}
```

- [ ] **Step 3: Verificar que el mobile compila**

```bash
cd apps/mobile
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/api/orders.ts apps/mobile/app/\(tabs\)/pedidos/\[id\].tsx
git commit -m "feat(mobile): show paymentMethodLabel and payment status in order detail"
```

---

## Task 12: Push y verificación final

- [ ] **Step 1: Push a main**

```bash
git push origin main
```

Esto dispara el CI/CD en Coolify. El deploy tarda ~5-8 minutos.

- [ ] **Step 2: Smoke test manual**

1. Entra al admin panel → Configuración → sección "Formas de pago"
2. Agrega "Efectivo" (sin confirmación) y "Clip" (sin confirmación)  
3. Agrega "Transferencia BBVA" (con confirmación activada)
4. Ve al menú QR de una tienda → agrega productos → checkout
5. Verifica que aparece el selector con los 3 métodos
6. Selecciona "Transferencia BBVA" → confirma que aparece el aviso de comprobante
7. Completa el pedido → verifica folio
8. En app móvil, abre el pedido → verifica que muestra "Transferencia BBVA" con badge "⏳ Pago pendiente"
9. En admin → Confirmar pago del pedido → badge debe desaparecer
