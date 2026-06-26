# Repartidores — Diseño del Módulo

## Contexto

Las fondas que usan PideFacil tienen repartidores propios que salen con pedidos de delivery, cobran en efectivo / tarjeta / transferencia, y liquidan el efectivo al regresar. Actualmente este proceso no tiene sistema: el admin controla todo por WhatsApp y libreta. Este módulo lo digitaliza sin cambiar el flujo operativo.

**Decisiones clave:**
- Arquitectura: rol `DELIVERY` en la app móvil existente (misma app, interfaz diferente por rol)
- Mínimo 2 repartidores operando simultáneamente
- El admin asigna pedidos; el repartidor no elige
- Repartidores ven montos desde que el pedido aparece en su app
- Liquidación es por **salida** (un turno puede tener varias salidas)

---

## 1. Modelo de Datos

### Cambios al schema existente

**`Role` enum** — agregar valor:
```
DELIVERY
```

**`Order`** — nuevos campos:
```prisma
assignedToId     String?   // userId del repartidor asignado
liquidationId    String?   // salida a la que pertenece
transferConfirmed Boolean  @default(false)  // para pedidos con paymentMethod = TRANSFER
```

### Nuevos modelos

**`Shift`** — representa el turno laboral de un repartidor:
```prisma
model Shift {
  id             String    @id @default(cuid())
  businessId     String
  branchId       String?
  deliveryUserId String    // usuario con role DELIVERY
  openedById     String    // OWNER u OPERATOR que abrió el turno
  closedById     String?
  status         ShiftStatus @default(OPEN)
  openedAt       DateTime  @default(now())
  closedAt       DateTime?
  notes          String?

  business       Business  @relation(...)
  deliveryUser   User      @relation("ShiftDelivery", ...)
  openedBy       User      @relation("ShiftOpenedBy", ...)
  liquidations   Liquidation[]
}

enum ShiftStatus {
  OPEN
  CLOSED
}
```

**`Liquidation`** — representa una salida dentro del turno:
```prisma
model Liquidation {
  id            String    @id @default(cuid())
  shiftId       String
  status        LiquidationStatus @default(OPEN)
  createdAt     DateTime  @default(now())
  closedAt      DateTime?
  confirmedById String?   // admin que liquidó
  cashTotal     Decimal   @default(0)
  cardTotal     Decimal   @default(0)
  transferTotal Decimal   @default(0)

  shift         Shift     @relation(...)
  orders        Order[]
}

enum LiquidationStatus {
  OPEN
  CLOSED
}
```

**Reglas de asignación:**
- Un pedido con `paymentMethod = TRANSFER` y `transferConfirmed = false` no puede asignarse a una salida
- Un pedido solo puede pertenecer a una `Liquidation` a la vez

---

## 2. Admin Panel

### Página `/turnos`

Lista de turnos del día por sucursal. Cada turno muestra: nombre del repartidor, hora de apertura, cantidad de pedidos asignados, estado (OPEN / CLOSED).

**Abrir turno** → modal:
- Seleccionar repartidor (usuarios `role = DELIVERY` del negocio)
- Seleccionar sucursal (si aplica)
- Crea registro `Shift` con `status = OPEN`

### Dentro de un turno abierto

**Sección "Esperando transferencia"**
Pedidos `CONFIRMED` con `transferConfirmed = false`. El admin toca **"Confirmar pago recibido"** → `transferConfirmed = true`, pedido avanza a `IN_PREPARATION`.

**Crear salida (Liquidación)**
El admin selecciona pedidos en estado `READY` (con `transferConfirmed = true` si aplica) y los agrupa en una nueva salida. Un turno puede tener múltiples salidas.

Cada pedido asignado muestra el nombre del repartidor en el kanban.

**Liquidar salida**
Cuando el repartidor regresa, el admin ve el resumen de esa salida:
- Pedidos entregados vs. total
- Efectivo a recibir del repartidor
- Totales por método de pago
- Botón **"Liquidar salida"** → registra totales en `Liquidation`, `status = CLOSED`

**Cerrar turno**
Cuando no hay salidas OPEN: botón **"Cerrar turno"** → resumen total de todas las liquidaciones del turno, `Shift.status = CLOSED`.

---

## 3. App Móvil — Modo DELIVERY

### Login

El usuario con `role = DELIVERY` inicia sesión en la misma app. Al detectar el rol, se muestra una interfaz diferente:
- No hay kanban ni menú administrativo
- Solo aparece: lista de pedidos asignados + historial + chat

### Pantalla principal — Pedidos de la salida actual

Lista de pedidos de la salida activa. Por cada pedido:
- Nombre del cliente + teléfono (con tap para llamar)
- Dirección de entrega + botón Maps
- Monto total + método de pago
- Estado: pendiente / entregado

### Flujo de entrega por pedido

1. Toca el pedido → detalle completo con dirección y notas
2. **"Salir a entregar"** → status `OUT_FOR_DELIVERY`
3. **"Confirmar entrega"** → status `DELIVERED`, `isPaid = true`
4. Si el cliente no está disponible → **"No entregado"** con nota opcional → pedido regresa a `READY` para reasignar

### Resumen de salida

Cuando el repartidor entrega todos los pedidos de la salida:
- Pedidos entregados / total
- Total en efectivo a entregar al admin
- Total cobrado en tarjeta
- Botón **"Avisar que regresé"** → notificación push al admin

### Chat con el cliente

Mientras el pedido esté asignado y no entregado, aparece un ícono de chat en el detalle del pedido. El repartidor puede enviar y recibir mensajes del cliente en tiempo real.

Al entregarse el pedido, el chat se cierra y se elimina automáticamente.

---

## 4. Transferencias — Flujo completo

1. Cliente elige `paymentMethod = TRANSFER` al ordenar
2. Pedido llega como `NEW` al admin
3. Admin confirma pedido → queda `CONFIRMED` con `transferConfirmed = false`
4. Panel muestra pedido en sección **"Esperando transferencia"** (no asignable)
5. Cliente ve en su página de seguimiento: *"Pedido confirmado. Envía tu pago a [número/CLABE del negocio]."*
6. Admin recibe comprobante (por WhatsApp) → toca **"Confirmar pago recibido"**
7. `transferConfirmed = true` → pedido avanza a `IN_PREPARATION` y queda disponible para asignar al repartidor

---

## 5. Chat Repartidor ↔ Cliente

### Tecnología

Firebase Realtime Database — ya en el stack para FCM. Sync en tiempo real, sin necesidad de WebSockets adicionales.

### Estructura de datos en Firebase

```
/chats/{orderId}/
  active: true
  messages/
    {msgId}:
      from: "CUSTOMER" | "DELIVERY"
      text: "¿En qué calle estás?"
      ts: 1718478923
```

### Ciclo de vida

| Evento (API) | Acción en Firebase |
|---|---|
| Admin asigna repartidor al pedido | `POST /chats/{orderId}` con `active: true` |
| Pedido → `DELIVERED` | `DELETE /chats/{orderId}` (chat y mensajes eliminados) |

### Acceso por superficie

**Repartidor (mobile app):**
- Ícono de chat en detalle del pedido
- Disponible mientras el pedido no esté en estado terminal
- Identificado como `DELIVERY` en Firebase

**Cliente (web tracking page):**
- Sección de chat aparece en la página de seguimiento cuando `order.assignedToId` no es null y el estado no es terminal
- Acceso anónimo; identificado como `CUSTOMER`
- Escucha mensajes en tiempo real vía Firebase SDK en el browser

### Notificaciones

- **Cliente → Repartidor:** FCM push notification a la app móvil
- **Repartidor → Cliente:** listener en tiempo real de Firebase en el browser (sin push)

### Seguridad (Firebase Rules)

```json
{
  "rules": {
    "chats": {
      "$orderId": {
        ".read": true,
        ".write": "auth != null || root.child('chats').child($orderId).child('active').val() === true"
      }
    }
  }
}
```

El API controla el ciclo de vida (creación y borrado); el cliente web y la app escriben mensajes directamente a Firebase validados por el `orderId`.

---

## Endpoints de API (resumen)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/shifts` | Abrir turno (admin) |
| `PATCH` | `/shifts/:id/close` | Cerrar turno (admin) |
| `POST` | `/shifts/:id/liquidations` | Crear salida y asignar pedidos |
| `PATCH` | `/liquidations/:id/close` | Liquidar salida (admin) |
| `PATCH` | `/orders/:id/confirm-transfer` | Confirmar pago de transferencia |
| `PATCH` | `/orders/:id/assign` | Asignar pedido a liquidación + repartidor |
| `GET` | `/delivery/orders` | Pedidos del repartidor activo (mobile) |
| `PATCH` | `/orders/:id/out-for-delivery` | Repartidor sale a entregar |
| `PATCH` | `/orders/:id/deliver` | Repartidor confirma entrega |
| `POST` | `/delivery/notify-return` | Repartidor avisa que regresó (push al admin) |

---

## Fases de implementación sugeridas

1. **Modelo de datos** — schema + migraciones
2. **API Shifts + Liquidations** — CRUD + reglas de negocio
3. **Admin Panel** — página `/turnos`, asignación, liquidación
4. **Mobile DELIVERY mode** — interfaz separada por rol, flujo de entrega
5. **Chat** — Firebase Realtime DB, integración en mobile y web tracking
6. **Transferencias** — confirmación de pago en panel + mensaje al cliente
