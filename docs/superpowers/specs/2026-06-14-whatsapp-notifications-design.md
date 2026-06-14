# WhatsApp Notifications — Design Spec

## Contexto

PideFacil usa WhatsApp actualmente de forma manual: el operador toca un botón para abrir una conversación con el cliente. Este módulo agrega **mensajes automáticos** al cliente en los cambios de estado clave del pedido, usando **Evolution API** (self-hosted, multi-sesión) donde cada negocio conecta su propio número de WhatsApp.

---

## 1. Infraestructura

**Evolution API** corre como un contenedor Docker adicional en Coolify en el VPS `2.24.201.108`, junto a PostgreSQL, Redis y MinIO.

Variables de entorno nuevas en `apps/api`:
```
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<clave-interna>
```

- Modo multi-sesión habilitado (por defecto en Evolution API v2)
- Cada negocio es una sesión con nombre igual a su `slug` (ej. `fonda-lupita`)
- La sesión persiste en el volumen Docker de Evolution API

---

## 2. Modelo de Datos

Un solo campo nuevo en `Business`:

```prisma
model Business {
  // ... campos existentes ...
  whatsappSession String?  // slug de sesión en Evolution API; null = no conectado
}
```

- `null` → el negocio nunca configuró WhatsApp
- Valor presente → sesión registrada (el QR fue escaneado al menos una vez)
- El estado de conexión en tiempo real (`open | connecting | close`) se consulta a Evolution API, no se almacena en BD

Requiere una migración Prisma additive, sin downtime.

---

## 3. API — WhatsappModule

### Ubicación
`apps/api/src/whatsapp/`

### WhatsappService

Wrapper sobre la REST API de Evolution. Todos los métodos usan `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` como header `apikey`.

| Método | Descripción |
|--------|-------------|
| `getOrCreateSession(slug)` | Crea la sesión en Evolution si no existe; idempotente |
| `getQrCode(slug)` | Devuelve QR como base64 para mostrar en admin |
| `getConnectionState(slug)` | Devuelve `open \| connecting \| close` |
| `disconnect(slug)` | Elimina la sesión de Evolution API |
| `sendStatusMessage(order, newStatus)` | Arma el mensaje y lo envía via Evolution API |

**Integración con OrdersService:** fire-and-forget al final de `updateStatus()`:
```typescript
this.whatsappService.sendStatusMessage(order, newStatus).catch(() => {});
```
Si Evolution API falla, el pedido igual se actualiza — WhatsApp es best-effort.

### WhatsappController

4 endpoints bajo `/admin/whatsapp`, todos con `@Roles(Role.OWNER, Role.ADMIN)`:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/whatsapp/status` | Estado de conexión (`open \| connecting \| close \| not_configured`) |
| `GET` | `/admin/whatsapp/qr` | QR code en base64 (solo si estado es `connecting`) |
| `POST` | `/admin/whatsapp/connect` | Crea sesión → devuelve QR inicial |
| `DELETE` | `/admin/whatsapp/disconnect` | Desconecta y elimina sesión; limpia `Business.whatsappSession` |

### Evolution API endpoints usados internamente

```
POST   /instance/create                    → crear sesión
GET    /instance/connectionState/{session} → estado
GET    /instance/qrcode/{session}          → QR base64
DELETE /instance/delete/{session}          → eliminar sesión
POST   /message/sendText/{session}         → enviar mensaje de texto
```

---

## 4. Mensajes por Estado

El destinatario es `order.customerPhone` con prefijo `52` si tiene 10 dígitos (México). Si el negocio no tiene `whatsappSession` o el estado no es `open`, el mensaje se omite silenciosamente.

| Transición → | Mensaje |
|---|---|
| `CONFIRMED` | `✅ *Pedido #{{folio}} confirmado*\n\n¡Hola {{nombre}}! Tu pedido en *{{negocio}}* fue aceptado. Ya lo estamos preparando. 🍳` |
| `READY` (pickup o entrega) | `🍽️ *Pedido #{{folio}} listo*\n\n¡Tu pedido en *{{negocio}}* está listo para recoger!` |
| `OUT_FOR_DELIVERY` | `🚗 *Pedido #{{folio}} en camino*\n\nTu pedido de *{{negocio}}* ya va en camino. ¡Prepárate!` |
| `DELIVERED` | `🎉 *Pedido #{{folio}} entregado*\n\n¡Buen provecho, {{nombre}}! Gracias por pedir en *{{negocio}}*.` |
| `CANCELLED` o `REJECTED` | `❌ *Pedido #{{folio}} cancelado*\n\nLo sentimos, tu pedido en *{{negocio}}* fue cancelado. Disculpa el inconveniente.` |

Variables: `{{folio}}` = `order.orderNumber`, `{{nombre}}` = `order.customerName`, `{{negocio}}` = `business.name`.

---

## 5. Admin Panel

### Nueva página `/configuracion/whatsapp`

**Estado: No conectado** (`whatsappSession = null`)
- Título: "Conectar WhatsApp"
- Descripción: "Envía mensajes automáticos a tus clientes al confirmar, cuando el pedido esté listo, en camino y entregado."
- Botón primario "Conectar WhatsApp" → llama `POST /admin/whatsapp/connect` → muestra QR

**Estado: Escaneando** (sesión existe pero estado = `connecting`)
- QR code en pantalla, se refresca automáticamente cada 20 segundos (polling `GET /admin/whatsapp/qr`)
- Badge naranja "Esperando escaneo…"
- Instrucciones: "Abre WhatsApp → Menú → Dispositivos vinculados → Vincular dispositivo → Escanea este código"
- Botón "Cancelar" → llama `DELETE /admin/whatsapp/disconnect`

**Estado: Conectado** (estado = `open`)
- Badge verde "✓ Conectado"
- Vista previa de los 5 mensajes automáticos que recibirán los clientes
- Botón "Desconectar" con confirmación antes de ejecutar

### Sidebar
Enlace "WhatsApp" en la sección Configuración con un indicador de estado:
- 🟢 verde = conectado
- ⚫ gris = no configurado / desconectado

---

## 6. Coolify — Docker Compose

Agregar a la configuración de servicios en Coolify o como `docker-compose.yml` en el repo:

```yaml
evolution-api:
  image: atendai/evolution-api:v2
  restart: always
  environment:
    SERVER_URL: http://evolution-api:8080
    AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
    DATABASE_ENABLED: false
    REDIS_ENABLED: false
  volumes:
    - evolution_data:/evolution/instances
```

No requiere base de datos propia ni Redis — Evolution API guarda las sesiones en disco.

---

## 7. Orden de Implementación

1. **Coolify setup** — desplegar contenedor Evolution API en VPS, configurar variables de entorno
2. **Schema migration** — `Business.whatsappSession String?`
3. **WhatsappModule** — servicio + controller + integración con OrdersService
4. **Admin Panel** — página `/configuracion/whatsapp` con los 3 estados
5. **Sidebar link** — con indicador de estado
