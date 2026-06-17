# Spec: Mejoras UX de Pedidos — Admin + QR Web

**Fecha:** 2026-06-17  
**Áreas:** `apps/admin`, `apps/web`  
**API:** Sin cambios — reutiliza endpoints existentes

---

## Contexto

Tres mejoras al flujo de pedidos identificadas en piloto:

1. El operador necesita poder capturar pedidos telefónicos directamente desde la admin, sin que el cliente escanee el QR.
2. Los clientes en el QR quieren personalizar su pedido rápidamente (sin picante, sin cebolla) sin tener que escribir.
3. El botón "Enviar por WhatsApp" en la pantalla post-pedido es redundante porque la plataforma ya lo hace automáticamente.

---

## Feature 1: Crear pedido desde Admin

### Descripción

Un botón "＋ Nuevo pedido" en la página de lista de pedidos (`/pedidos`) abre un Sheet lateral. El operador captura el pedido completo y lo crea usando el mismo endpoint público que el QR.

### Componentes

**`apps/admin/src/app/(admin)/pedidos/page.tsx`**
- Agregar botón "＋ Nuevo pedido" en el header de la página, a la derecha del título.
- Mantiene el estado `createOpen: boolean` para controlar el Sheet.

**`apps/admin/src/components/orders/create-order-sheet.tsx`** ← nuevo
- Sheet con `side="right"`, ancho `sm:max-w-lg`.
- Cuatro secciones en scroll único (sin steps/wizard).

### Secciones del Sheet

**① Datos del cliente**
- Input "Teléfono" (10 dígitos).
- Al perder foco (`onBlur`): llama `GET /customers?search={phone}` con el token del operador.
  - Si existe: muestra nombre precargado + badge "Cliente conocido · N pedidos". El nombre es editable.
  - Si no existe: input "Nombre" vacío para captura manual.
- Ambos campos son requeridos para continuar.

**② Productos**
- Carga el menú con `GET /public/business/:slug/categories` (incluye productos con `isAvailable: true`).
- Agrupado por categoría (acordeones colapsables, abiertos por defecto).
- Cada producto: nombre · precio · controles `–  0  +`.
- Si el producto tiene variantes (`variants.length > 0`) y la cantidad es ≥ 1: aparece un `<select>` para elegir la variante. Variante requerida antes de poder confirmar.
- Resumen sticky al fondo del Sheet: "N productos · $XXX".

**③ Tipo de entrega**
- Radio: "🏃 Recoger en tienda" (PICKUP) / "🛵 A domicilio" (DELIVERY).
- Si DELIVERY: campos "Dirección (calle y número)" (requerido) y "Referencias" (opcional).

**④ Pago y notas**
- Si el negocio tiene métodos de pago configurados: radio con las opciones.
- Textarea "Notas del pedido" (opcional).
- Botón primario "Crear pedido" (deshabilitado si: falta teléfono, nombre, o no hay productos).

### Llamada a la API

Al confirmar, llama `POST /public/orders` con el payload estándar:

```typescript
{
  businessId: string,               // del contexto de la sesión admin
  customer: { name, phone },
  deliveryType: 'PICKUP' | 'DELIVERY',
  address?: { street, references? },
  notes?: string,
  paymentMethodId?: string,
  items: [{ productId, variantId?, quantity }]
}
```

Al éxito: cierra el Sheet, invalida la query de pedidos (`queryClient.invalidateQueries(['orders'])`), muestra toast "Pedido #N creado".

### Endpoints reutilizados (sin cambios)

| Endpoint | Uso |
|---|---|
| `GET /customers?search={phone}` | Lookup cliente por teléfono (auth requerida) |
| `GET /public/business/:slug/categories` | Cargar menú con productos |
| `GET /public/business/:slug/payment-methods` | Cargar métodos de pago |
| `POST /public/orders` | Crear el pedido |

---

## Feature 2: Tags de notas rápidas en checkout QR

### Descripción

En `checkout-form.tsx`, encima del textarea "Notas del pedido", se agregan chips clickeables con las opciones de personalización más comunes. El textarea sigue siendo editable libremente.

### Componente

**`apps/web/src/components/checkout/checkout-form.tsx`**
- Agregar chips antes del `<textarea>` de notas del pedido.
- Los chips son parte del mismo campo — no un campo separado.

### Tags disponibles (hardcodeados, orden fijo)

```
Sin picante · Sin cebolla · Sin cilantro · Extra salsa
Sin chile · Poca sal · Sin queso · Para llevar
```

### Comportamiento

- **Click en chip inactivo:** agrega el texto del chip al textarea. Si el textarea ya tiene contenido, agrega con `, ` de separador. Resultado: `"Sin picante, sin cebolla"`.
- **Click en chip activo:** elimina el texto del chip del textarea (incluyendo la coma y espacios adyacentes). El chip se detecta como activo cuando su texto está presente en el valor del textarea (búsqueda case-insensitive).
- **Edición libre:** el usuario puede escribir cualquier texto adicional o borrar manualmente. Los chips se resaltan/apagan según el contenido actual del textarea.

### Estilos

- Chip inactivo: `border border-gray-200 bg-white text-gray-600 text-xs rounded-full px-3 py-1`
- Chip activo: `border border-brand-500 bg-brand-50 text-brand-700 text-xs rounded-full px-3 py-1`
- Contenedor: `flex flex-wrap gap-2 mb-2`

---

## Feature 3: Eliminar botón WhatsApp en pantalla post-pedido

### Descripción

En `apps/web/src/app/[slug]/pedido-enviado/page.tsx`, eliminar el botón "💬 Enviar por WhatsApp" y actualizar el texto de la pantalla para reflejar que el aviso ya fue enviado automáticamente.

### Cambios

**Botones — antes:**
1. 💬 Enviar por WhatsApp (verde)
2. 📋 Ver estado del pedido (borde brand-500)
3. ← Volver al menú (link gris)

**Botones — después:**
1. **📋 Ver estado del pedido** → pasa a botón primario (`bg-brand-500 text-white`)
2. **← Volver al menú** → se mantiene como link gris

**Texto de la pantalla — antes:**
> "El negocio revisará tu pedido y te contactará al {phone}"

**Texto — después:**
> "Te avisaremos por WhatsApp cuando tu pedido sea confirmado."

El parámetro `businessPhone` ya no se necesita en los query params de la URL. No es necesario cambiar el payload del checkout.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `apps/admin/src/app/(admin)/pedidos/page.tsx` | Agregar botón + estado `createOpen` + importar Sheet |
| `apps/admin/src/components/orders/create-order-sheet.tsx` | **Nuevo** — Sheet completo |
| `apps/web/src/components/checkout/checkout-form.tsx` | Agregar chips antes del textarea de notas |
| `apps/web/src/app/[slug]/pedido-enviado/page.tsx` | Eliminar botón WhatsApp, actualizar texto, promover botón "Ver estado" |

---

## Sin cambios en API

Todos los endpoints requeridos ya existen. No se necesitan migraciones ni cambios en `apps/api`.
