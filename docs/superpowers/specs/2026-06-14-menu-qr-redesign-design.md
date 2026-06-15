# Spec: Rediseño Visual del Menú QR Público

**Fecha:** 2026-06-14  
**Scope:** `apps/web` (menú público QR) + `apps/api` (nuevo campo + endpoint) + `apps/admin` (campo noteHints en producto, selector de tema)

---

## Objetivo

Reemplazar el diseño funcional-pero-plano del menú QR por un diseño premium estilo restaurante: header oscuro con producto destacado, tarjetas con acento de color, placeholders con gradiente de marca, chips de personalización rápida y link de ubicación.

---

## Decisiones de diseño

| Elemento | Decisión |
|---|---|
| Estilo general | Premium/restaurante (oscuro → claro, acento naranja izquierdo) |
| "Más pedido hoy" | Sí, calculado automáticamente (últimos 7 días de OrderItem) |
| Placeholder sin foto | Gradiente `--brand → #1A1A2E` + emoji de la categoría |
| Descripción en tarjeta | No — solo en bottom sheet al tocar |
| Chips de personalización | Sí, por producto, configurados por el dueño en admin |
| Link de ubicación | Sí — dirección del negocio/sucursal abre Google Maps |
| Color de acento | Paletas predefinidas (8 temas), configurable por negocio en admin |

---

## Sistema de temas de color

Cada negocio elige uno de 8 temas predefinidos que reemplaza el naranja `#FF6B35` en todo el menú público. El header oscuro (`#1A1A2E`) siempre permanece igual.

### Catálogo de temas

| Key | Nombre | Color primario | Emoji |
|---|---|---|---|
| `naranja` | Naranja | `#FF6B35` | 🔥 |
| `verde` | Verde | `#27AE60` | 🌿 |
| `rojo` | Rojo | `#E74C3C` | 🌶️ |
| `azul` | Azul | `#2980B9` | 💙 |
| `morado` | Morado | `#8E44AD` | 💜 |
| `rosa` | Rosa | `#E91E8C` | 🌸 |
| `dorado` | Dorado | `#F39C12` | ✨ |
| `turquesa` | Turquesa | `#16A085` | 🌊 |

El default cuando `Business.menuColor` es `null` es `naranja`.

### Campo en BD

```prisma
// model Business — agregar:
menuColor  String?  // key del tema: "naranja" | "verde" | "rojo" | ...
```

### Implementación CSS — variables dinámicas

En `apps/web/src/app/[slug]/page.tsx`, el color del tema se inyecta como CSS variable en el wrapper raíz:

```tsx
const THEMES: Record<string, string> = {
  naranja:  '#FF6B35',
  verde:    '#27AE60',
  rojo:     '#E74C3C',
  azul:     '#2980B9',
  morado:   '#8E44AD',
  rosa:     '#E91E8C',
  dorado:   '#F39C12',
  turquesa: '#16A085',
};

const brandColor = THEMES[business.menuColor ?? 'naranja'];

return (
  <div style={{ '--brand': brandColor } as React.CSSProperties}>
    ...
  </div>
);
```

Todos los componentes de `apps/web` usan `var(--brand)` en lugar de clases Tailwind hardcodeadas para el color primario:

| Antes (hardcoded) | Después (variable) |
|---|---|
| `bg-brand-500` / `bg-[#FF6B35]` | `bg-[var(--brand)]` |
| `text-brand-500` / `text-[#FF6B35]` | `text-[var(--brand)]` |
| `border-brand-500` | `border-[var(--brand)]` |
| `from-brand-500` (gradiente) | `from-[var(--brand)]` |

El archivo `tailwind.config.ts` de `apps/web` **no cambia** — la variable `--brand` se resuelve en runtime. El color `#1A1A2E` del header y la oscuridad del cart bar son siempre fijos.

### Selector de tema en admin

En la pantalla de configuración del negocio (`apps/admin`), sección **Apariencia del menú**:

- Muestra 8 swatches en grid 4×2
- Cada swatch: círculo de color + nombre del tema debajo
- El seleccionado tiene borde exterior naranja (del sistema admin, no del tema)
- Al guardar, hace `PATCH /business/:id` con `{ menuColor: "verde" }`

---

## Paleta y tokens visuales

```
Brand primary:   var(--brand)  ← dinámico, default #FF6B35
Brand dark:      #1A1A2E       ← siempre fijo
Page bg:         #F7F8FA       (antes: blanco)
Card bg:         #FFFFFF
Card border:     #ECEDF0
Accent stripe:   4px, var(--brand), left side of card
Category title:  uppercase bold 11px, color #1A1A2E + emoji
```

---

## 1. Backend — campo `noteHints` en `Product`

### Prisma schema

Agregar a `model Product`:

```prisma
noteHints  String[]
```

### Migración

```sql
ALTER TABLE "Product" ADD COLUMN "noteHints" TEXT[] NOT NULL DEFAULT '{}';
```

### DTOs afectados

- `apps/api/src/menus/dto/create-product.dto.ts` — agregar `@IsString({ each: true }) @IsArray() @IsOptional() noteHints?: string[]`
- `apps/api/src/menus/dto/update-product.dto.ts` — mismo campo opcional
- La respuesta pública (`GET /menu/:slug`) ya serializa todos los campos del producto; `noteHints` se incluirá automáticamente.

---

## 2. Backend — producto "más pedido" en el menú público

### Endpoint existente

`GET /menu/:slug` devuelve `{ business, branches, menus }`. Se extiende para incluir `featuredProduct`.

### Lógica

```ts
// En MenusService.getPublicMenu(slug, branchId?)
const featuredProduct = await prisma.orderItem.groupBy({
  by: ['productId'],
  where: {
    order: {
      businessId: business.id,
      createdAt: { gte: subDays(new Date(), 7) },
      status: { not: 'CANCELLED' },
    },
  },
  _count: { productId: true },
  orderBy: { _count: { productId: 'desc' } },
  take: 1,
});
// Si hay resultado, incluir el producto completo; si no, null
```

### Respuesta extendida

```ts
{
  business: { ... },
  branches: [ ... ],
  menus: [ ... ],
  featuredProduct: Product | null  // nuevo campo
}
```

### Fallback

Si no hay pedidos en los últimos 7 días, `featuredProduct: null` y el bloque "Más pedido hoy" no se renderiza.

---

## 3. Backend — link de ubicación

No se requiere campo nuevo. `Branch` ya tiene `latitude: Float` y `longitude: Float`. La URL se genera en el frontend:

```ts
const mapsUrl = `https://maps.google.com/?q=${branch.latitude},${branch.longitude}`;
```

`Business` tiene `address: String?` pero no lat/lng. Si la selección de sucursal está activa, se usa la sucursal seleccionada. Si no hay sucursal (negocio de una sola ubicación sin Branch), se usa `business.address` con búsqueda textual:

```ts
const mapsUrl = business.address
  ? `https://maps.google.com/?q=${encodeURIComponent(business.address)}`
  : null;
```

---

## 4. Frontend `apps/web` — componentes modificados

### 4.1 `business-header.tsx`

**Antes:** header oscuro simple con logo + nombre + dirección en texto plano.

**Después:**
- Dirección como `<a>` naranja con ícono ↗, abre Google Maps en tab nuevo
- Bloque "Más pedido hoy" (naranja translúcido, estrella, nombre + precio + botón `+`)
  - Solo se renderiza si `featuredProduct !== null`
  - El botón `+` del featured llama al mismo `addItem` que las tarjetas
- Logo cuadrado con `border-radius: 10px` (antes circular)

**Props nuevas:**

```ts
interface BusinessHeaderProps {
  business: BusinessPublic;
  featuredProduct: Product | null;  // nuevo
  selectedBranch: PublicBranch | null;  // nuevo — para link de ubicación
  slug: string;  // nuevo — para addItem del featured
}
```

### 4.2 `product-card.tsx`

**Antes:** `flex` horizontal, imagen 64×64 circular, botón `+` naranja circular, descripción visible.

**Después:**
- Acento naranja izquierdo: `<div>` de 4px ancho, `bg-brand-500`, `self-stretch`, `rounded-l-sm`
- Sin descripción en la tarjeta
- Imagen: 62×62, `rounded-[10px]`
- Placeholder si no hay `imageUrl`: gradiente `from-brand-500 to-brand-900` + emoji de categoría (prop nueva `categoryEmoji`)
- Botón `+`: cuadrado `28×28`, `bg-brand-900`, `rounded-[7px]`, abajo de la imagen
- Precio más grande: `text-[14px] font-extrabold text-brand-500`

**Props nuevas:**

```ts
interface ProductCardProps {
  product: Product;
  slug: string;
  categoryEmoji?: string;  // nuevo — para placeholder
}
```

### 4.3 `product-list.tsx`

**Antes:** título de categoría en `bg-gray-50` sticky con `text-base font-bold`.

**Después:**
- Fondo del contenedor: `bg-[#F7F8FA]`
- Título de categoría: emoji + texto uppercase 11px bold, sin fondo sticky separado
- Se elimina el `sticky top-[104px]` del título (simplifica el scroll)
- `divide-y` eliminado — el gap entre tarjetas es `gap-2` en flex column

**Campo `emoji` en Category:** se agrega `emoji: String?` al modelo `Category` en Prisma (campo nuevo, opcional). Si `null`, no se muestra emoji. El admin puede asignarlo al crear/editar una categoría.

### 4.4 `category-pills.tsx`

Sin cambios de lógica. Ajuste visual menor: padding `py-[5px]` (antes `py-1.5`).

### 4.5 `product-sheet.tsx` — chips de notas rápidas

**Nuevo bloque** entre "Extras" y "Notas":

```tsx
{product.noteHints.length > 0 && (
  <div className="mt-4">
    <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
      Personalizar
    </p>
    <div className="flex flex-wrap gap-2">
      {product.noteHints.map((hint) => {
        const active = activeHints.includes(hint);
        return (
          <button
            key={hint}
            type="button"
            onClick={() => toggleHint(hint)}
            className={active
              ? 'px-3 py-1 rounded-full border-2 border-brand-500 bg-brand-50 text-brand-500 text-xs font-bold'
              : 'px-3 py-1 rounded-full border-2 border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold'
            }
          >
            {active ? '✓ ' : ''}{hint}
          </button>
        );
      })}
    </div>
  </div>
)}
```

**Estado nuevo:** `const [activeHints, setActiveHints] = useState<string[]>([])`

**Integración con notas:** los hints activos se prepend al campo `notes`:

```ts
const toggleHint = (hint: string) => {
  setActiveHints(prev =>
    prev.includes(hint) ? prev.filter(h => h !== hint) : [...prev, hint]
  );
};

// Al construir el payload de addItem:
const hintText = activeHints.join(', ');
const fullNotes = [hintText, notes.trim()].filter(Boolean).join('. ');
```

### 4.6 `lib/api.ts`

- Agregar `noteHints: string[]` a la interfaz `Product`
- Agregar `featuredProduct: Product | null` a la respuesta de `getPublicMenu`
- Agregar `emoji?: string` a la interfaz `Category`

### 4.7 `app/[slug]/page.tsx`

Pasar `featuredProduct` y `selectedBranch` a `<BusinessHeader>`.

---

## 5. Frontend `apps/admin` — edición de `noteHints` y `categoryEmoji`

### Producto — campo `imageUrl` (hint de tamaño)

El campo de imagen del producto debe mostrar un helper text visible debajo del input:

```
Imagen del producto · Recomendado: 400 × 400 px (cuadrada), JPG o PNG, máx 2 MB.
Se muestra en 62 × 62 px en el menú y en pantalla completa en el detalle del platillo.
```

Este texto aparece como `<p className="text-xs text-gray-400 mt-1">` debajo del input de URL o del botón de subida de imagen, en las pantallas de crear y editar producto.

### Producto — campo `noteHints`

En el formulario de crear/editar producto, agregar un input de tags debajo de "Descripción":

- Label: **Sugerencias de personalización** (ej: sin cebolla, con picante)
- UI: input de texto + botón "Agregar", chips eliminables con ×
- Se guarda como `string[]` en el body del request
- Máximo 10 hints por producto

### Categoría — campo `emoji`

En el formulario de crear/editar categoría, agregar campo de texto "Emoji" (1 carácter), opcional. Placeholder: `🍲`.

---

## 6. Migración de datos

```sql
-- noteHints en Product
ALTER TABLE "Product" ADD COLUMN "noteHints" TEXT[] NOT NULL DEFAULT '{}';

-- emoji en Category
ALTER TABLE "Category" ADD COLUMN "emoji" TEXT;

-- menuColor en Business
ALTER TABLE "Business" ADD COLUMN "menuColor" TEXT;
```

### DTOs de Business

`PATCH /businesses/:id` ya existe en el módulo de admin. Agregar `menuColor?: string` a `UpdateBusinessDto` con validación:

```ts
@IsString()
@IsOptional()
@IsIn(['naranja','verde','rojo','azul','morado','rosa','dorado','turquesa'])
menuColor?: string;
```

La respuesta pública `GET /menu/:slug` ya devuelve el objeto `business`; agregar `menuColor: string | null` a la serialización pública.

---

## 7. Cart bar

**Cambio visual:** fondo `#1A1A2E` (antes `bg-brand-500`). Precio en `text-brand-500` (naranja). Texto de productos en blanco.

---

## Componentes no afectados

- `cart-drawer.tsx` — sin cambios
- `checkout/page.tsx` — sin cambios
- `pedido-enviado/page.tsx` — sin cambios
- `order/order-status.tsx` — sin cambios
- `branch-picker.tsx` — sin cambios

---

## Consideraciones técnicas

- **`featuredProduct` query performance:** el `groupBy` sobre `OrderItem` con filtro de 7 días es potencialmente pesado. Se ejecuta solo en `getPublicMenu` y se puede cachear en Redis con TTL de 10 minutos si se vuelve lento.
- **Sin foto + sin emoji de categoría:** el placeholder muestra solo el gradiente, sin emoji. Aceptable.
- **SSR:** `apps/web` usa SSR en `page.tsx`. `featuredProduct` viene del servidor, sin llamada extra del cliente.
- **Chips no son extras:** los `noteHints` van a `OrderItem.notes` como texto libre, no a `OrderItem.extras`. El operador los lee como instrucciones en la app móvil.
