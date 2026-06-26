# WhatsApp Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar mensajes automáticos de WhatsApp al cliente en cada cambio de estado clave del pedido, usando Evolution API self-hosted en Coolify con una sesión por negocio.

**Architecture:** Evolution API v2 corre como contenedor Docker en Coolify (multi-sesión, sin DB propia). NestJS agrega un `WhatsappModule` que hace HTTP calls con `fetch` a Evolution API. `OrdersService.updateStatus()` llama `WhatsappService.sendStatusMessage()` como fire-and-forget. El admin panel tiene una página `/settings/whatsapp` con QR para conectar el número del negocio.

**Tech Stack:** Evolution API v2 (Docker), Node.js `fetch` (nativo Node 24), NestJS module pattern, Prisma (campo `whatsappSession` en Business), React TanStack Query + polling para el QR.

---

## File Map

| Acción | Archivo |
|---|---|
| Modify | `apps/api/prisma/schema.prisma` — `whatsappSession String?` en Business |
| Create | `apps/api/prisma/migrations/20260614_whatsapp_session/migration.sql` |
| Create | `apps/api/src/whatsapp/whatsapp.service.ts` |
| Create | `apps/api/src/whatsapp/whatsapp.controller.ts` |
| Create | `apps/api/src/whatsapp/whatsapp.module.ts` |
| Create | `apps/api/src/whatsapp/whatsapp.integration.spec.ts` |
| Modify | `apps/api/src/app.module.ts` — registrar WhatsappModule |
| Modify | `apps/api/src/orders/orders.service.ts` — inyectar WhatsappService, fire-and-forget |
| Modify | `apps/api/src/orders/orders.module.ts` — importar WhatsappModule |
| Create | `apps/admin/src/api/whatsapp.ts` |
| Create | `apps/admin/src/hooks/use-whatsapp.ts` |
| Create | `apps/admin/src/app/(admin)/settings/whatsapp/page.tsx` |
| Modify | `apps/admin/src/components/layout/sidebar.tsx` — enlace WhatsApp |

---

## Task 1: Schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260614_whatsapp_session/migration.sql`

- [ ] **Step 1: Agregar `whatsappSession` al modelo Business en `apps/api/prisma/schema.prisma`**

Busca el modelo `Business` y agrega la línea marcada:

```prisma
model Business {
  id        String         @id @default(cuid())
  name      String
  slug      String         @unique
  phone     String
  whatsapp  String?
  logoUrl   String?
  coverUrl  String?
  address   String?
  timezone  String         @default("America/Mexico_City")
  status    BusinessStatus @default(ACTIVE)
  whatsappSession String?  // ← AGREGAR ESTA LÍNEA
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  users             User[]
  menus             Menu[]
  // ... resto de relaciones sin cambios
```

- [ ] **Step 2: Crear el archivo de migración manualmente**

Crea `apps/api/prisma/migrations/20260614_whatsapp_session/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Business" ADD COLUMN "whatsappSession" TEXT;
```

- [ ] **Step 3: Regenerar el cliente Prisma**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil/apps/api
npx prisma generate
```

Expected: `✔ Generated Prisma Client` sin errores.

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): add whatsappSession to Business for Evolution API multi-session"
```

---

## Task 2: Infrastructure — Evolution API en Coolify

**Pasos manuales** (no son código — son configuración en el VPS). Documentar en el repo para reproducibilidad.

- [ ] **Step 1: Agregar `docker-compose.override.yml` en el repo** (para documentar el servicio)

Crea `apps/api/docker-compose.whatsapp.yml`:

```yaml
version: '3.8'
services:
  evolution-api:
    image: atendai/evolution-api:v2.2.3
    restart: always
    ports:
      - "8080:8080"
    environment:
      SERVER_URL: "http://localhost:8080"
      AUTHENTICATION_TYPE: "apikey"
      AUTHENTICATION_API_KEY: "${EVOLUTION_API_KEY}"
      QRCODE_LIMIT: "30"
      DEL_INSTANCE: "false"
      DATABASE_ENABLED: "false"
      REDIS_ENABLED: "false"
      LOG_LEVEL: "ERROR"
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store

volumes:
  evolution_instances:
  evolution_store:
```

- [ ] **Step 2: En Coolify — crear nuevo servicio Docker**

En el panel de Coolify (`http://localhost:8000` desde el VPS vía SSH):
1. New Resource → Docker Compose
2. Pegar el contenido de `docker-compose.whatsapp.yml`
3. Agregar variable de entorno: `EVOLUTION_API_KEY=<genera un token seguro con `openssl rand -hex 32`>`
4. Deploy

- [ ] **Step 3: Agregar variables de entorno en el servicio API de Coolify**

En la configuración del servicio `pidefacil-api` en Coolify, agregar:
```
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<mismo valor que en el paso anterior>
```

> Nota: `evolution-api` resuelve por nombre de servicio Docker dentro de la misma red de Coolify.

- [ ] **Step 4: Verificar que Evolution API responde**

Desde el VPS (via SSH del runner o Coolify terminal):
```bash
curl -H "apikey: <TU_KEY>" http://localhost:8080/instance/fetchInstances
```
Expected: `[]` (array vacío — sin instancias aún).

- [ ] **Step 5: Agregar las variables de entorno al `.env.example` del API**

En `apps/api/.env.example` (o crear si no existe), agregar:
```
# WhatsApp — Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-evolution-api-key
```

- [ ] **Step 6: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/api/docker-compose.whatsapp.yml apps/api/.env.example
git commit -m "infra: add Evolution API Docker Compose config and env vars documentation"
```

---

## Task 3: WhatsappModule (NestJS)

**Files:**
- Create: `apps/api/src/whatsapp/whatsapp.service.ts`
- Create: `apps/api/src/whatsapp/whatsapp.controller.ts`
- Create: `apps/api/src/whatsapp/whatsapp.module.ts`
- Create: `apps/api/src/whatsapp/whatsapp.integration.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Escribir el test de integración primero**

Crea `apps/api/src/whatsapp/whatsapp.integration.spec.ts`:

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('WhatsappModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const suffix = Date.now();
  const mockFetch = jest.fn();

  beforeAll(async () => {
    global.fetch = mockFetch as any;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    // Registrar negocio + obtener JWT (patrón estándar de los integration specs)
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        businessName: `Fonda WA Test ${suffix}`,
        slug: `fonda-wa-${suffix}`,
        phone: '5512345678',
        ownerName: 'Dueño WA',
        email: `wa-owner-${suffix}@test.com`,
        password: 'Password123!',
      })
      .expect(201);

    ownerToken = registerRes.body.access_token;
    businessId = registerRes.body.business.id;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await prisma.subscription.deleteMany({ where: { businessId } });
    await prisma.user.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await app.close();
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('GET /admin/whatsapp/status → not_configured cuando no hay sesión', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/whatsapp/status')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.status).toBe('not_configured');
  });

  it('POST /admin/whatsapp/connect → crea sesión y devuelve QR', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ instance: { instanceName: `fonda-wa-${suffix}`, status: 'created' } }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: '2@abc123', base64: 'data:image/png;base64,iVBOR==' }),
      } as any);

    const res = await request(app.getHttpServer())
      .post('/admin/whatsapp/connect')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(res.body.qr).toMatch(/^data:image\/png;base64,/);
    expect(res.body.status).toBe('connecting');

    const updated = await prisma.business.findUnique({ where: { id: businessId } });
    expect(updated?.whatsappSession).toBe(`fonda-wa-${suffix}`);
  });

  it('GET /admin/whatsapp/status → open cuando Evolution responde open', async () => {
    await prisma.business.update({ where: { id: businessId }, data: { whatsappSession: `fonda-wa-${suffix}` } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { instanceName: `fonda-wa-${suffix}`, state: 'open' } }),
    } as any);

    const res = await request(app.getHttpServer())
      .get('/admin/whatsapp/status')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.status).toBe('open');
  });

  it('DELETE /admin/whatsapp/disconnect → elimina sesión y limpia BD', async () => {
    await prisma.business.update({ where: { id: businessId }, data: { whatsappSession: `fonda-wa-${suffix}` } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'SUCCESS' }),
    } as any);

    await request(app.getHttpServer())
      .delete('/admin/whatsapp/disconnect')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const updated = await prisma.business.findUnique({ where: { id: businessId } });
    expect(updated?.whatsappSession).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil/apps/api
npx jest --testPathPattern=whatsapp.integration --runInBand
```

Expected: FAIL — `WhatsappModule` no existe aún.

- [ ] **Step 3: Crear `apps/api/src/whatsapp/whatsapp.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WHATSAPP_STATUSES = new Set([
  OrderStatus.CONFIRMED,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
]);

const STATUS_MESSAGES: Partial<Record<OrderStatus, (folio: string, name: string, business: string) => string>> = {
  [OrderStatus.CONFIRMED]: (f, n, b) =>
    `✅ *Pedido #${f} confirmado*\n\n¡Hola ${n}! Tu pedido en *${b}* fue aceptado. Ya lo estamos preparando. 🍳`,
  [OrderStatus.READY]: (f, _n, b) =>
    `🍽️ *Pedido #${f} listo*\n\n¡Tu pedido en *${b}* está listo para recoger!`,
  [OrderStatus.OUT_FOR_DELIVERY]: (f, _n, b) =>
    `🚗 *Pedido #${f} en camino*\n\nTu pedido de *${b}* ya va en camino. ¡Prepárate!`,
  [OrderStatus.DELIVERED]: (f, n, b) =>
    `🎉 *Pedido #${f} entregado*\n\n¡Buen provecho, ${n}! Gracias por pedir en *${b}*.`,
  [OrderStatus.CANCELLED]: (f, _n, b) =>
    `❌ *Pedido #${f} cancelado*\n\nLo sentimos, tu pedido en *${b}* fue cancelado. Disculpa el inconveniente.`,
  [OrderStatus.REJECTED]: (f, _n, b) =>
    `❌ *Pedido #${f} cancelado*\n\nLo sentimos, tu pedido en *${b}* fue cancelado. Disculpa el inconveniente.`,
};

@Injectable()
export class WhatsappService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = this.config.get<string>('EVOLUTION_API_URL') ?? '';
    this.apiKey = this.config.get<string>('EVOLUTION_API_KEY') ?? '';
  }

  private headers() {
    return { 'Content-Type': 'application/json', apikey: this.apiKey };
  }

  private async evo<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<T>;
  }

  async connectAndGetQr(businessId: string): Promise<{ status: 'connecting'; qr: string }> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');
    await this.evo('POST', '/instance/create', {
      instanceName: biz.slug,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
    await this.prisma.business.update({ where: { id: businessId }, data: { whatsappSession: biz.slug } });
    const qrData = await this.evo<{ base64?: string }>('GET', `/instance/connect/${biz.slug}`);
    return { status: 'connecting', qr: qrData.base64 ?? '' };
  }

  async getQrByBusinessId(businessId: string): Promise<string | null> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { whatsappSession: true } });
    if (!biz?.whatsappSession) return null;
    const data = await this.evo<{ base64?: string }>('GET', `/instance/connect/${biz.whatsappSession}`);
    return data.base64 ?? null;
  }

  async getConnectionState(businessId: string): Promise<'open' | 'connecting' | 'close' | 'not_configured'> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { whatsappSession: true } });
    if (!biz?.whatsappSession) return 'not_configured';
    try {
      const data = await this.evo<{ instance?: { state?: string } }>('GET', `/instance/connectionState/${biz.whatsappSession}`);
      const state = data.instance?.state;
      if (state === 'open') return 'open';
      if (state === 'connecting') return 'connecting';
      return 'close';
    } catch {
      return 'close';
    }
  }

  async disconnect(businessId: string): Promise<void> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { whatsappSession: true } });
    if (biz?.whatsappSession) {
      await this.evo('DELETE', `/instance/delete/${biz.whatsappSession}`, { deleteFiles: false }).catch(() => {});
      await this.prisma.business.update({ where: { id: businessId }, data: { whatsappSession: null } });
    }
  }

  async sendStatusMessage(
    order: { businessId: string; orderNumber: string; customerName: string; customerPhone: string },
    newStatus: OrderStatus,
  ): Promise<void> {
    if (!WHATSAPP_STATUSES.has(newStatus)) return;

    const biz = await this.prisma.business.findUnique({
      where: { id: order.businessId },
      select: { name: true, whatsappSession: true },
    });
    if (!biz?.whatsappSession) return;

    const state = await this.getConnectionState(order.businessId);
    if (state !== 'open') return;

    const buildMessage = STATUS_MESSAGES[newStatus];
    if (!buildMessage) return;

    const digits = order.customerPhone.replace(/\D/g, '');
    const phone = digits.length === 10 ? `52${digits}` : digits;
    const text = buildMessage(order.orderNumber, order.customerName, biz.name);

    await this.evo('POST', `/message/sendText/${biz.whatsappSession}`, { number: phone, text });
  }
}
```

- [ ] **Step 4: Crear `apps/api/src/whatsapp/whatsapp.controller.ts`**

```typescript
import { Controller, Get, Post, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { WhatsappService } from './whatsapp.service';

@Controller('admin/whatsapp')
@Roles(Role.OWNER, Role.ADMIN)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: CurrentUserPayload) {
    const status = await this.whatsappService.getConnectionState(user.businessId);
    return { status };
  }

  @Get('qr')
  async getQr(@CurrentUser() user: CurrentUserPayload) {
    const qr = await this.whatsappService.getQrByBusinessId(user.businessId);
    return { qr };
  }

  @Post('connect')
  @HttpCode(HttpStatus.CREATED)
  async connect(@CurrentUser() user: CurrentUserPayload) {
    return this.whatsappService.connectAndGetQr(user.businessId);
  }

  @Delete('disconnect')
  async disconnect(@CurrentUser() user: CurrentUserPayload) {
    await this.whatsappService.disconnect(user.businessId);
    return { status: 'disconnected' };
  }
}
```

- [ ] **Step 5: Crear `apps/api/src/whatsapp/whatsapp.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
```

- [ ] **Step 6: Registrar WhatsappModule en `apps/api/src/app.module.ts`**

Agrega la importación al array `imports` de AppModule (junto a los demás módulos):

```typescript
import { WhatsappModule } from './whatsapp/whatsapp.module';

// En @Module({ imports: [...] }):
WhatsappModule,
```

- [ ] **Step 7: Correr los tests**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil/apps/api
npx jest --testPathPattern=whatsapp.integration --runInBand
```

Expected: 4/4 PASS.

- [ ] **Step 8: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 9: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/api/src/whatsapp/ apps/api/src/app.module.ts
git commit -m "feat(api): add WhatsappModule with Evolution API multi-session support"
```

---

## Task 4: Integración con OrdersService

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts`
- Modify: `apps/api/src/orders/orders.module.ts`

- [ ] **Step 1: Importar WhatsappModule en `apps/api/src/orders/orders.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersAdminController } from './orders.admin.controller';
import { OrdersService } from './orders.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [NotificationsModule, WhatsappModule],
  controllers: [OrdersController, OrdersAdminController],
  providers: [OrdersService, RateLimitGuard],
})
export class OrdersModule {}
```

- [ ] **Step 2: Inyectar WhatsappService en `apps/api/src/orders/orders.service.ts`**

Agrega el import en la parte superior del archivo:
```typescript
import { WhatsappService } from '../whatsapp/whatsapp.service';
```

Agrega al constructor (junto a `notificationsService`):
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly notificationsService: NotificationsService,
  private readonly whatsappService: WhatsappService,
) {}
```

- [ ] **Step 3: Llamar a `sendStatusMessage` al final de `updateStatus()`**

Encuentra el bloque final de `updateStatus()` que contiene `return this.findOne(id, businessId)` y agrega la llamada **antes** del return:

```typescript
  // ... (lógica existente de trust level, etc.)

  // Fire-and-forget: no bloquea la respuesta si WhatsApp falla
  this.whatsappService.sendStatusMessage(
    {
      businessId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
    },
    newStatus,
  ).catch(() => {});

  return this.findOne(id, businessId);
}
```

- [ ] **Step 4: Verificar que los tests existentes de orders siguen pasando**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil/apps/api
npx jest --testPathPattern=orders.integration --runInBand
```

Expected: todos los tests de orders en PASS. (WhatsApp es fire-and-forget y falla silenciosamente cuando no hay Evolution API en CI.)

- [ ] **Step 5: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 6: Commit**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/api/src/orders/orders.service.ts apps/api/src/orders/orders.module.ts
git commit -m "feat(orders): send WhatsApp notification on status change (fire-and-forget)"
```

---

## Task 5: Admin Panel — Página WhatsApp

**Files:**
- Create: `apps/admin/src/api/whatsapp.ts`
- Create: `apps/admin/src/hooks/use-whatsapp.ts`
- Create: `apps/admin/src/app/(admin)/settings/whatsapp/page.tsx`
- Modify: `apps/admin/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Crear `apps/admin/src/api/whatsapp.ts`**

```typescript
import { api } from '@/lib/api';

export type WhatsappStatus = 'open' | 'connecting' | 'close' | 'not_configured';

export async function getWhatsappStatus(): Promise<{ status: WhatsappStatus }> {
  const { data } = await api.get('/admin/whatsapp/status');
  return data;
}

export async function getWhatsappQr(): Promise<{ qr: string | null }> {
  const { data } = await api.get('/admin/whatsapp/qr');
  return data;
}

export async function connectWhatsapp(): Promise<{ status: string; qr: string }> {
  const { data } = await api.post('/admin/whatsapp/connect');
  return data;
}

export async function disconnectWhatsapp(): Promise<void> {
  await api.delete('/admin/whatsapp/disconnect');
}
```

- [ ] **Step 2: Crear `apps/admin/src/hooks/use-whatsapp.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/whatsapp';

export const useWhatsappStatus = (refetchInterval?: number) =>
  useQuery({
    queryKey: ['whatsapp', 'status'],
    queryFn: api.getWhatsappStatus,
    refetchInterval,
  });

export const useWhatsappQr = (enabled: boolean) =>
  useQuery({
    queryKey: ['whatsapp', 'qr'],
    queryFn: api.getWhatsappQr,
    enabled,
    refetchInterval: enabled ? 20_000 : false,
  });

export const useConnectWhatsapp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.connectWhatsapp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp'] }),
  });
};

export const useDisconnectWhatsapp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.disconnectWhatsapp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp'] }),
  });
};
```

- [ ] **Step 3: Crear `apps/admin/src/app/(admin)/settings/whatsapp/page.tsx`**

```tsx
'use client';

import Image from 'next/image';
import {
  useWhatsappStatus,
  useWhatsappQr,
  useConnectWhatsapp,
  useDisconnectWhatsapp,
} from '@/hooks/use-whatsapp';

const MESSAGE_PREVIEWS = [
  { emoji: '✅', label: 'Al confirmar', text: 'Pedido #42 confirmado — Ya lo estamos preparando. 🍳' },
  { emoji: '🍽️', label: 'Listo para recoger', text: 'Pedido #42 listo — ¡Pasa por él!' },
  { emoji: '🚗', label: 'En camino', text: 'Pedido #42 en camino — ¡Prepárate!' },
  { emoji: '🎉', label: 'Entregado', text: 'Pedido #42 entregado — ¡Buen provecho!' },
  { emoji: '❌', label: 'Cancelado', text: 'Pedido #42 cancelado — Disculpa el inconveniente.' },
];

export default function WhatsappPage() {
  const { data: statusData, isLoading } = useWhatsappStatus(5_000);
  const status = statusData?.status ?? 'not_configured';

  const isConnecting = status === 'connecting';
  const isConnected = status === 'open';

  const { data: qrData } = useWhatsappQr(isConnecting);
  const connect = useConnectWhatsapp();
  const disconnect = useDisconnectWhatsapp();

  const handleConnect = async () => {
    await connect.mutateAsync();
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Los clientes dejarán de recibir notificaciones automáticas.')) return;
    await disconnect.mutateAsync();
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <h1 className="font-jakarta font-bold text-brand-900 text-xl">WhatsApp</h1>
        <p className="text-sm text-gray-400 mt-1">
          Notifica a tus clientes automáticamente en cada cambio de estado.
        </p>
      </div>

      {/* Estado: no configurado */}
      {status === 'not_configured' || status === 'close' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="font-bold text-gray-900 mb-1">Conecta tu WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-6">
            Los mensajes se enviarán desde el número de WhatsApp de tu negocio.
          </p>
          <button
            onClick={handleConnect}
            disabled={connect.isPending}
            className="bg-green-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-600 disabled:opacity-50"
          >
            {connect.isPending ? 'Conectando...' : 'Conectar WhatsApp'}
          </button>
          {connect.isError && (
            <p className="text-sm text-red-500 mt-3">Error al conectar. Intenta de nuevo.</p>
          )}
        </div>
      ) : null}

      {/* Estado: escaneando QR */}
      {isConnecting ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-semibold text-amber-600">Esperando escaneo…</span>
          </div>

          {qrData?.qr ? (
            <div className="flex justify-center mb-4">
              <Image
                src={qrData.qr}
                alt="WhatsApp QR Code"
                width={220}
                height={220}
                className="rounded-lg border border-gray-100"
              />
            </div>
          ) : (
            <div className="w-[220px] h-[220px] mx-auto bg-gray-100 rounded-lg animate-pulse mb-4" />
          )}

          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside mb-4">
            <li>Abre WhatsApp en tu celular</li>
            <li>Ve a <strong>Menú → Dispositivos vinculados</strong></li>
            <li>Toca <strong>Vincular dispositivo</strong></li>
            <li>Escanea este código QR</li>
          </ol>

          <p className="text-xs text-gray-400 mb-4">El código se actualiza cada 20 segundos.</p>

          <button
            onClick={handleDisconnect}
            disabled={disconnect.isPending}
            className="w-full border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {/* Estado: conectado */}
      {isConnected ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="font-semibold text-gray-900">WhatsApp conectado</span>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
                className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
              >
                {disconnect.isPending ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Mensajes automáticos
            </p>
            <div className="space-y-3">
              {MESSAGE_PREVIEWS.map((msg) => (
                <div key={msg.label} className="flex items-start gap-3">
                  <span className="text-lg">{msg.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">{msg.label}</p>
                    <p className="text-sm text-gray-800">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Agregar enlace WhatsApp en `apps/admin/src/components/layout/sidebar.tsx`**

Lee el archivo para encontrar el array de nav items y agrega WhatsApp con un indicador de estado.

El import de lucide ya tiene `Settings`. Agrega `MessageSquare`:
```typescript
import { LayoutDashboard, UtensilsCrossed, Settings, Users, Users2, LogOut, BarChart2, MapPin, DollarSign, MessageSquare } from 'lucide-react';
```

Agrega el item después de `{ href: '/settings', ... }`:
```typescript
{ href: '/settings/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter admin exec tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 6: Commit y push**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
git add apps/admin/src/api/whatsapp.ts apps/admin/src/hooks/use-whatsapp.ts \
  apps/admin/src/app/\(admin\)/settings/whatsapp/ apps/admin/src/components/layout/sidebar.tsx
git commit -m "feat(admin): WhatsApp settings page with QR connect flow"
git push origin main
```
