# Fase 9 — Sucursales (Branches) Design Spec

## Contexto

PideFacil ya cuenta con fases 0–8 completas. Esta fase agrega soporte multi-sucursal a nivel negocio: cada negocio puede tener N sucursales según su plan, con disponibilidad de platillos y programación de menús independiente por sucursal, un solo QR con detección GPS, control de dispositivos por tenant, y ciclo completo de pedidos con forma de pago y liquidación de efectivo.

---

## 1. Modelo de Datos

### Modelos nuevos

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
  daysOfWeek Int[]   // 0=Dom 1=Lun … 6=Sáb — vacío = siempre activo (menú FIXED)

  branch Branch @relation(fields: [branchId], references: [id])
  menu   Menu   @relation(fields: [menuId], references: [id])

  @@unique([branchId, menuId])
}

model Device {
  id         String       @id @default(cuid())
  businessId String
  branchId   String?
  userId     String?
  name       String       // "Tablet Cocina 1"
  deviceType DeviceType
  token      String       @unique // fingerprint generado en el dispositivo
  status     DeviceStatus @default(PENDING)
  lastSeenAt DateTime?
  createdAt  DateTime     @default(now())

  business Business  @relation(fields: [businessId], references: [id])
  branch   Branch?   @relation(fields: [branchId], references: [id])
  user     User?     @relation(fields: [userId], references: [id])

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

### Cambios a modelos existentes

**Order:**
```prisma
branchId      String?
paymentMethod PaymentMethod?  // obligatorio al confirmar (CONFIRMED)
isPaid        Boolean         @default(false)
```

**OrderStatus enum — nuevo valor:**
```prisma
OUT_FOR_DELIVERY  // entre READY y DELIVERED
```

**Plan:**
```prisma
maxDevices Int
```

### Regla de negocio crítica

`READY → OUT_FOR_DELIVERY` solo permitido si:
- `paymentMethod == CASH` **o**
- `isPaid == true` (recepción confirmó transferencia/otro)

---

## 2. API

### BranchModule (`/admin/branches`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/branches` | Lista sucursales del negocio |
| POST | `/admin/branches` | Crear sucursal (valida maxBranches) |
| GET | `/admin/branches/:id` | Detalle |
| PATCH | `/admin/branches/:id` | Editar |
| DELETE | `/admin/branches/:id` | Eliminar (solo sin pedidos activos) |
| GET | `/admin/branches/:id/menu-schedules` | Horarios de menús |
| PUT | `/admin/branches/:id/menu-schedules` | Reemplaza todos los horarios |
| GET | `/admin/branches/:id/product-availability` | Disponibilidad de platillos |
| PATCH | `/admin/branches/:id/product-availability` | Actualiza overrides |

### DeviceModule (`/admin/devices`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/admin/devices/register` | Registra dispositivo nuevo (queda PENDING) |
| GET | `/admin/devices` | Lista dispositivos del negocio |
| PATCH | `/admin/devices/:id/approve` | Aprueba dispositivo (valida maxDevices) |
| PATCH | `/admin/devices/:id/block` | Bloquea dispositivo |
| DELETE | `/admin/devices/:id` | Elimina registro |

### LiquidationModule (`/admin/liquidations`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/admin/liquidations` | Repartidor entrega efectivo |
| GET | `/admin/liquidations` | Historial (filtro fecha/sucursal) |

### Cambios a módulos existentes

**PublicModule:**
```
GET /public/business/:slug/branches         — sucursales con lat/lng para picker GPS
GET /public/business/:slug/menu?branchId=X  — menú filtrado por disponibilidad de sucursal
```

**OrdersModule:**
- `POST /public/orders` — ahora requiere `branchId` y `paymentMethod`
- `PATCH /admin/orders/:id/confirm-payment` — recepción confirma pago (transfer/otro)
- Guard en transición `READY → OUT_FOR_DELIVERY`: verifica `paymentMethod == CASH || isPaid`

**Auth middleware:** al login desde app móvil verifica que el `Device.token` esté `ACTIVE`. Si el token no existe lo registra como `PENDING` y responde `403 DEVICE_PENDING`. Si está `BLOCKED` responde `403 DEVICE_BLOCKED`.

---

## 3. Admin Panel

### Sidebar
Se añade **"Sucursales"** entre Menús y Clientes. Solo visible si el plan tiene `maxBranches > 0`.

### Páginas

**`/sucursales`**
- Lista de sucursales: tarjeta con nombre, dirección, status, contador de dispositivos activos
- Botón "+ Nueva sucursal" deshabilitado si `activeBranches >= plan.maxBranches`

**`/sucursales/[id]`** — 4 pestañas:

1. **Info general:** nombre, dirección, teléfono, lat/lng con botón "Usar mi ubicación actual"

2. **Menús:** tabla con todos los menús del negocio
   - Toggle activo/inactivo por menú en esta sucursal
   - Si `menu.type == DAILY`: chips de días de semana (Lu Ma Mi Ju Vi Sa Do)
   - Si `menu.type == FIXED`: sin selector (siempre activo cuando el toggle está on)

3. **Platillos:** productos agrupados por categoría
   - Toggle disponible/no disponible por platillo en esta sucursal
   - Indicador visual cuando el estado difiere del default del negocio

4. **Dispositivos:** tabla con nombre, tipo (Recepción/Cocina/Repartidor), status, última conexión
   - Acciones: Aprobar / Bloquear por fila
   - Contador `X / maxDevices activos`

**`/liquidaciones`**
- Tabla: fecha, sucursal, repartidor, monto, recibido por
- Botón "+ Registrar liquidación"

---

## 4. Web QR

### Flujo al abrir `pidefacil.mx/[slug]`

1. Solicita permiso de geolocalización del navegador
2. Mientras resuelve (o si se deniega), muestra **picker de sucursales**:
   - Lista todas las sucursales activas del negocio
   - Con GPS: distancia calculada, la más cercana destacada en naranja con etiqueta "Más cercana"
   - Sin GPS: muestra todas sin orden de distancia, el cliente selecciona manualmente
3. Una vez seleccionada la sucursal, carga el menú filtrado por:
   - `BranchMenuSchedule` activo para el día actual
   - `BranchProductAvailability` overrides de esa sucursal
4. El header muestra la sucursal activa con botón para cambiar en cualquier momento

**Si el negocio tiene solo 1 sucursal activa:** se omite el picker y se carga el menú directamente (comportamiento idéntico a fases anteriores).

**Si el negocio no tiene sucursales configuradas:** se muestra el menú sin filtrado por sucursal (compatibilidad hacia atrás con negocios del piloto).

**Tracking de pedido** (`/[slug]/pedido/[orderNumber]`): muestra la dirección de la sucursal donde se realizó el pedido.

---

## 5. App Móvil

### Registro de dispositivo (primer login)

1. Usuario ingresa credenciales
2. App envía `deviceToken` (fingerprint) junto con las credenciales
3. Si el token no está registrado: API responde `403 { code: 'DEVICE_PENDING' }`
4. App muestra pantalla de espera: "Tu dispositivo está pendiente de aprobación"
5. Dueño aprueba desde panel admin → pestaña Dispositivos
6. Usuario hace login nuevamente, recibe JWT normalmente

**Generación del fingerprint:** `SHA256(Platform.OS + Device.modelName + AsyncStorage.uuid)` donde el UUID se genera una vez al primer arranque y persiste en AsyncStorage. Se usa `expo-crypto` para el hash.

**Tipo de dispositivo:** el usuario selecciona su rol (Recepción / Cocina / Repartidor) en la pantalla de primer login, antes de enviar el registro. Este valor se envía junto con el token y el nombre del dispositivo.

**Asignación de sucursal:** el admin asigna la sucursal al aprobar el dispositivo desde el panel. Un dispositivo aprobado sin sucursal asignada ve pedidos de todas las sucursales del negocio.

### Kanban por rol

| Rol | Columnas visibles | Transiciones permitidas |
|-----|-------------------|------------------------|
| Recepción | NUEVO, CONFIRMADO, LISTO, ENTREGADO | NUEVO→CONFIRMADO (+ forma de pago obligatoria), LISTO→ENTREGADO (pickup), confirmar pago (transfer) |
| Cocina | CONFIRMADO, EN PREPARACIÓN, LISTO | CONFIRMADO→EN PREPARACIÓN, EN PREPARACIÓN→LISTO |
| Repartidor | LISTO, EN CAMINO, ENTREGADO | LISTO→EN CAMINO (solo si pago confirmado o efectivo), EN CAMINO→ENTREGADO+COBRADO |

Los pedidos se filtran por `branchId` del usuario logueado (asignado al aprobar el dispositivo).

### Liquidación

- Al marcar EN CAMINO→ENTREGADO con efectivo: se captura el monto cobrado (pre-llenado con `order.total`)
- Botón "Liquidar turno" en el menú del repartidor: suma todos los pedidos en efectivo del turno y abre formulario de liquidación

---

## 6. Planes actualizados

| Plan | Sucursales | Dispositivos | Usuarios | Productos |
|------|-----------|--------------|----------|-----------|
| Básico | 1 | 4 (1 recep + 1 cocina + 2 repartidores) | 4 | 50 |
| Pro | 3 | 12 | 10 | 150 |
| Plus | 10 | 40 | 30 | ilimitado (-1) |

---

## 7. Orden de implementación

1. **Schema + migración** — modelos Branch, BranchProductAvailability, BranchMenuSchedule, Device, Liquidation + campos en Order y Plan
2. **BranchModule API** — CRUD + menu-schedules + product-availability
3. **DeviceModule API** — registro, aprobación, guard en auth
4. **LiquidationModule API** — crear y listar
5. **Cambios OrdersModule** — branchId, paymentMethod, isPaid, OUT_FOR_DELIVERY, guard READY→OUT_FOR_DELIVERY, confirm-payment endpoint
6. **PublicModule** — branches endpoint, menú filtrado por sucursal
7. **Admin: Sucursales** — páginas /sucursales y /sucursales/[id] con 4 pestañas
8. **Admin: Liquidaciones** — página /liquidaciones
9. **Web QR** — picker GPS, menú filtrado por sucursal
10. **Mobile** — device registration flow, kanban por rol, liquidación de turno
