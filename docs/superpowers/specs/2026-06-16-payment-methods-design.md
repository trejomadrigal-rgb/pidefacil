# Formas de Pago Configurables — Design Spec

## Contexto

El checkout del menú QR actualmente no captura la forma de pago: el campo `paymentMethod` llega null al backend y los operadores ven "—" en los pedidos. El negocio necesita definir su catálogo de formas de pago aceptadas (texto libre, ej: "Clip", "OXXO Pay", "Transferencia BBVA") y el cliente debe seleccionar una al ordenar.

## Decisiones de diseño

- **Catálogo libre por negocio**: el negocio define sus propios métodos con etiquetas de texto libre
- **Compartido entre sucursales**: un solo catálogo por negocio (no por sucursal)
- **Flag `requiresConfirmation`**: el negocio indica si cada método requiere confirmar el pago antes de preparar — reemplaza el check hardcodeado `paymentMethod !== CASH`
- **Snapshot en el pedido**: se guarda `paymentMethodLabel` en el momento de ordenar para preservar historial si el método se edita o elimina
- **Compatibilidad hacia atrás**: el campo enum `paymentMethod` existente queda como legacy (null en nuevos pedidos), no se migra ni elimina

---

## 1. Modelo de datos

### Nueva tabla: `BusinessPaymentMethod`

```prisma
model BusinessPaymentMethod {
  id                   String   @id @default(cuid())
  businessId           String
  label                String   // Ej: "Clip", "Efectivo", "Transferencia BBVA"
  requiresConfirmation Boolean  @default(false)
  isActive             Boolean  @default(true)
  position             Int      @default(0)
  createdAt            DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  orders   Order[]
}
```

### Cambios en `Order`

```prisma
paymentMethodId    String?
paymentMethodLabel String?  // snapshot del label al momento de crear el pedido

customPaymentMethod BusinessPaymentMethod? @relation(fields: [paymentMethodId], references: [id], onDelete: SetNull)
```

El campo `paymentMethod PaymentMethod?` (enum) permanece en el schema como legacy — quedará null en todos los pedidos nuevos.

### Cambios en `Business`

Agregar la relación inversa:
```prisma
paymentMethods BusinessPaymentMethod[]
```

---

## 2. API

### Endpoints de administración

Todos bajo `/admin/payment-methods`, requieren rol `OWNER` o `ADMIN`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/payment-methods` | Lista todos los métodos del negocio, ordenados por `position` |
| `POST` | `/admin/payment-methods` | Crea un método `{ label, requiresConfirmation, position? }` |
| `PATCH` | `/admin/payment-methods/:id` | Actualiza `{ label?, requiresConfirmation?, isActive?, position? }` |
| `DELETE` | `/admin/payment-methods/:id` | Elimina si no tiene pedidos; si tiene, retorna 409 con sugerencia de desactivar |

### Endpoint público

```
GET /public/business/:slug/payment-methods
```

- Sin autenticación
- Retorna solo métodos con `isActive: true`, ordenados por `position ASC`
- Response: `[{ id, label, requiresConfirmation }]`

### Modificaciones a endpoints existentes

**`POST /public/orders`**
- Acepta `paymentMethodId?: string` en el DTO
- Si el negocio tiene métodos activos y no se envía `paymentMethodId` → error 400
- Si el negocio no tiene métodos activos → `paymentMethodId` ignorado, ambos campos quedan null
- Al crear: guarda `paymentMethodId` + `paymentMethodLabel` (snapshot del `label` en ese momento)

**`orders.service.ts` — validación de salida a delivery**

Antes:
```typescript
if (order.paymentMethod !== PaymentMethod.CASH && !order.isPaid)
```

Después:
```typescript
if (order.customPaymentMethod?.requiresConfirmation && !order.isPaid)
```

**`orders.service.ts` — `confirmTransfer`**

El método ya existente (`PATCH /orders/:id/confirm-transfer`) permanece sin cambios de ruta. Internamente cambia la validación:

Antes: `where: { id: orderId, businessId, paymentMethod: 'TRANSFER' }`
Después: busca el pedido por `id + businessId`, luego verifica `order.customPaymentMethod?.requiresConfirmation === true`. Si no requiere confirmación, retorna 400.

**`whatsapp.service.ts`**

- Usa `order.paymentMethodLabel ?? 'No especificado'` en lugar del `PAYMENT_LABEL` hardcodeado
- La nota de comprobante (`⚠️ Importante...`) se activa cuando `order.customPaymentMethod?.requiresConfirmation === true`

---

## 3. Admin Panel (`apps/admin`)

### Ubicación

Nueva sección **"Formas de pago"** en `/settings`, debajo del formulario del negocio. Implementada como componente `PaymentMethodsSection` en `apps/admin/src/components/settings/payment-methods-section.tsx`.

### UI

```
┌─ Formas de pago ──────────────────────────────┐
│                                               │
│  [✓] Efectivo                    ✏️  🗑️       │
│  [✓] Clip               ⚠️ confirmar  ✏️  🗑️  │
│  [ ] Transferencia BBVA  ⚠️ confirmar  ✏️  🗑️  │
│                                               │
│  + Agregar forma de pago                      │
└───────────────────────────────────────────────┘
```

- **Toggle** activo/inactivo por método (PATCH isActive)
- **⚠️** indica `requiresConfirmation: true`
- **Editar** abre formulario inline: campo de texto + checkbox
- **Eliminar**: si el método tiene pedidos asociados, retorna error 409 y la UI muestra "No se puede eliminar — tiene pedidos. Puedes desactivarlo."
- **"+ Agregar"**: formulario con campo `label` (requerido) y checkbox `requiresConfirmation`
- Orden: `position` se asigna automáticamente (último al final). Sin reordenamiento manual en esta versión.

### Hooks y API client

```typescript
// apps/admin/src/api/payment-methods.ts
getPaymentMethods()
createPaymentMethod({ label, requiresConfirmation })
updatePaymentMethod(id, { label?, requiresConfirmation?, isActive? })
deletePaymentMethod(id)

// apps/admin/src/hooks/use-payment-methods.ts
usePaymentMethods()       // useQuery
useCreatePaymentMethod()  // useMutation
useUpdatePaymentMethod()  // useMutation
useDeletePaymentMethod()  // useMutation
```

---

## 4. Menú QR web (`apps/web`)

### Carga de métodos

Los métodos activos se cargan en `getBusinessMenu()` (o como llamada independiente en la misma página) junto con el resto de los datos del menú. Se agrega `getPaymentMethods(slug)` a `apps/web/src/lib/api.ts`.

### Checkout form

En `apps/web/src/components/checkout/checkout-form.tsx`:

- Se agrega prop `paymentMethods: { id: string; label: string; requiresConfirmation: boolean }[]`
- Si el array está vacío → el selector no se renderiza, `paymentMethodId` se omite del payload
- Si hay métodos → se renderiza selector de radio buttons estilizados con el sistema de diseño bold/colorful (`#FF6B35` para el seleccionado)
- Métodos con `requiresConfirmation: true` muestran texto secundario: _"Se te pedirá comprobante antes de preparar tu pedido"_
- La selección es obligatoria para poder confirmar el pedido

### Payload de createOrder

```typescript
interface CreateOrderPayload {
  // ... campos existentes
  paymentMethodId?: string;  // nuevo campo opcional
}
```

---

## 5. App móvil (`apps/mobile`)

### Cambios en detalle de pedido

En `apps/(tabs)/pedidos/[id].tsx`:
- Muestra `order.paymentMethodLabel ?? order.paymentMethod ?? '—'` (fallback para pedidos legacy)
- Si `order.customPaymentMethod?.requiresConfirmation && !order.isPaid` → badge naranja "⏳ Pago pendiente" junto al método

### Tipos

El tipo `Order` en `apps/mobile/src/api/orders.ts` agrega:
```typescript
paymentMethodLabel: string | null;
customPaymentMethod: { requiresConfirmation: boolean } | null;
```

---

## 6. Flujo completo (happy path)

1. Negocio configura en Settings → "Formas de pago": agrega "Efectivo" (sin confirmación) y "Clip" (sin confirmación) y "Transferencia BBVA" (con confirmación)
2. Cliente escanea QR → ve el menú → agrega productos al carrito → abre checkout
3. Checkout muestra selector: ○ Efectivo / ○ Clip / ○ Transferencia BBVA ⚠️
4. Cliente selecciona "Transferencia BBVA" → ve aviso de comprobante → confirma pedido
5. API crea `Order` con `paymentMethodId` + `paymentMethodLabel: "Transferencia BBVA"`
6. WhatsApp al operador incluye "Transferencia BBVA" + nota de comprobante
7. App móvil muestra pedido con badge "⏳ Pago pendiente"
8. Operador recibe comprobante → confirma pago → pedido avanza a `IN_PREPARATION`
9. Cliente ve en order-status que el pedido está en preparación

---

## 7. Casos edge

| Caso | Comportamiento |
|---|---|
| Negocio sin métodos configurados | Checkout no muestra selector; pedido se crea con `paymentMethodId: null` |
| Método eliminado después de ordenar | `paymentMethodId` queda null (SetNull), `paymentMethodLabel` preserva el nombre |
| Eliminar método con pedidos | API retorna 409; UI sugiere desactivar en lugar de eliminar |
| Método desactivado | No aparece en checkout público; pedidos existentes conservan referencia |

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `apps/api/prisma/schema.prisma` | Nueva tabla `BusinessPaymentMethod` + campos en `Order` + relación en `Business` |
| `apps/api/prisma/migrations/` | Nueva migración |
| `apps/api/src/payment-methods/` | Nuevo módulo: controller + service + DTOs + module |
| `apps/api/src/orders/dto/create-order.dto.ts` | Agrega `paymentMethodId` opcional |
| `apps/api/src/orders/orders.service.ts` | Ajusta validación delivery + snapshot en create + confirmTransfer |
| `apps/api/src/whatsapp/whatsapp.service.ts` | Usa `paymentMethodLabel` y `requiresConfirmation` |
| `apps/api/src/app.module.ts` | Registra `PaymentMethodsModule` |
| `apps/web/src/lib/api.ts` | Agrega `getPaymentMethods()` + `paymentMethodId` en `CreateOrderPayload` |
| `apps/web/src/app/[slug]/page.tsx` | Pasa `paymentMethods` al checkout |
| `apps/web/src/components/checkout/checkout-form.tsx` | Selector de forma de pago |
| `apps/admin/src/api/payment-methods.ts` | Nuevo cliente API |
| `apps/admin/src/hooks/use-payment-methods.ts` | Hooks TanStack Query |
| `apps/admin/src/components/settings/payment-methods-section.tsx` | Componente UI |
| `apps/admin/src/app/(admin)/settings/page.tsx` | Incluye `PaymentMethodsSection` |
| `apps/mobile/src/api/orders.ts` | Agrega tipos nuevos |
| `apps/mobile/app/(tabs)/pedidos/[id].tsx` | Muestra label + badge pago pendiente |
