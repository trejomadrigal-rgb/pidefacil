# Rediseño Visual del Menú QR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el menú QR público con estilo premium: header oscuro, tarjetas con acento de marca, sistema de 8 temas de color por negocio, chips de personalización rápida por producto, y link de ubicación.

**Architecture:** El backend agrega 3 campos a la BD (noteHints, Category.emoji, Business.menuColor) y un nuevo endpoint de producto destacado. El frontend de `apps/web` inyecta la paleta de color como CSS variable `--brand` en el wrapper raíz para que todos los componentes la consuman. El admin expone los nuevos campos en los formularios existentes.

**Tech Stack:** NestJS + Prisma (API), Next.js 15 App Router + Tailwind (web), Next.js + React Hook Form + Zod (admin), TanStack Query (admin hooks)

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `apps/api/prisma/schema.prisma` | Modify — 3 campos nuevos |
| `apps/api/prisma/migrations/20260614_menu_redesign/migration.sql` | Create |
| `apps/api/src/products/dto/create-product.dto.ts` | Modify — noteHints |
| `apps/api/src/products/dto/update-product.dto.ts` | Modify — noteHints |
| `apps/api/src/categories/dto/create-category.dto.ts` | Modify — emoji |
| `apps/api/src/categories/dto/update-category.dto.ts` | Modify — emoji |
| `apps/api/src/business/dto/update-business.dto.ts` | Modify — menuColor |
| `apps/api/src/public/public.service.ts` | Modify — extend 3 métodos, agregar getFeaturedProduct |
| `apps/api/src/public/public.controller.ts` | Modify — nuevo endpoint |
| `apps/web/src/lib/api.ts` | Modify — tipos + getFeaturedProduct |
| `apps/web/src/app/[slug]/page.tsx` | Modify — CSS var wrapper, pasar featuredProduct |
| `apps/web/src/components/menu/business-header.tsx` | Modify — redesign completo |
| `apps/web/src/components/menu/featured-product-button.tsx` | Create — botón cliente para featured |
| `apps/web/src/components/menu/product-card.tsx` | Modify — redesign completo |
| `apps/web/src/components/menu/product-list.tsx` | Modify — títulos con emoji, fondo |
| `apps/web/src/components/menu/category-pills.tsx` | Modify — padding menor |
| `apps/web/src/components/menu/product-sheet.tsx` | Modify — chips de noteHints |
| `apps/web/src/components/cart/cart-bar.tsx` | Modify — fondo oscuro |
| `apps/admin/src/hooks/use-products.ts` | Modify — noteHints en interfaz Product |
| `apps/admin/src/hooks/use-categories.ts` | Modify — emoji en interfaz Category |
| `apps/admin/src/hooks/use-business.ts` | Modify — menuColor en interfaz Business |
| `apps/admin/src/components/menu-designer/product-form.tsx` | Modify — noteHints + imagen hint |
| `apps/admin/src/components/menu-designer/category-form.tsx` | Modify — emoji field |
| `apps/admin/src/components/settings/business-form.tsx` | Modify — color swatch picker |

---

## Task 1: Prisma schema + migración SQL

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260614_menu_redesign/migration.sql`

- [ ] **Step 1: Agregar 3 campos al schema**

En `apps/api/prisma/schema.prisma`, dentro de `model Product` (después de `isFeatured`):

```prisma
noteHints  String[]
```

En `model Category` (después de `sortOrder`):

```prisma
emoji      String?
```

En `model Business` (después de `address`):

```prisma
menuColor  String?
```

- [ ] **Step 2: Crear archivo de migración**

Crear `apps/api/prisma/migrations/20260614_menu_redesign/migration.sql`:

```sql
ALTER TABLE "Product" ADD COLUMN "noteHints" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Category" ADD COLUMN "emoji" TEXT;
ALTER TABLE "Business" ADD COLUMN "menuColor" TEXT;
```

- [ ] **Step 3: Aplicar migración en la BD de desarrollo**

```bash
cd apps/api && npx prisma migrate dev --name menu_redesign
```

Esperado: `The following migration(s) have been applied: 20260614_menu_redesign`

- [ ] **Step 4: Verificar que el cliente Prisma se regeneró**

```bash
cd apps/api && npx prisma generate
```

Esperado: `Generated Prisma Client` sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): add noteHints, Category.emoji, Business.menuColor to schema"
```

---

## Task 2: DTOs del backend — noteHints, emoji, menuColor

**Files:**
- Modify: `apps/api/src/products/dto/create-product.dto.ts`
- Modify: `apps/api/src/products/dto/update-product.dto.ts`
- Modify: `apps/api/src/categories/dto/create-category.dto.ts`
- Modify: `apps/api/src/categories/dto/update-category.dto.ts`
- Modify: `apps/api/src/business/dto/update-business.dto.ts`

- [ ] **Step 1: Agregar noteHints a CreateProductDto**

`apps/api/src/products/dto/create-product.dto.ts`:

```typescript
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  noteHints?: string[];
}
```

- [ ] **Step 2: Agregar noteHints a UpdateProductDto**

`apps/api/src/products/dto/update-product.dto.ts`:

```typescript
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  noteHints?: string[];
}
```

- [ ] **Step 3: Agregar emoji a CreateCategoryDto y UpdateCategoryDto**

`apps/api/src/categories/dto/create-category.dto.ts`:

```typescript
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  menuId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;
}
```

`apps/api/src/categories/dto/update-category.dto.ts`:

```typescript
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  menuId?: string;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;
}
```

- [ ] **Step 4: Agregar menuColor a UpdateBusinessDto**

`apps/api/src/business/dto/update-business.dto.ts`:

```typescript
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

const MENU_COLORS = ['naranja','verde','rojo','azul','morado','rosa','dorado','turquesa'] as const;

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(MENU_COLORS)
  menuColor?: string;
}
```

- [ ] **Step 5: Compilar para verificar que no hay errores de tipos**

```bash
cd apps/api && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/products/dto/ apps/api/src/categories/dto/ apps/api/src/business/dto/
git commit -m "feat(api): add noteHints, emoji, menuColor to DTOs"
```

---

## Task 3: PublicService — extender con nuevos campos y getFeaturedProduct

**Files:**
- Modify: `apps/api/src/public/public.service.ts`

- [ ] **Step 1: Extender getBusiness para incluir menuColor**

En `getBusiness`, cambiar el `select` de línea 22:

```typescript
select: { id: true, name: true, slug: true, phone: true, logoUrl: true, address: true, menuColor: true },
```

- [ ] **Step 2: Extender getCategories para incluir emoji y noteHints**

En `getCategories`, dentro del `select` de `prisma.category.findMany` (línea ~68), cambiar `select`:

```typescript
select: {
  id: true,
  name: true,
  sortOrder: true,
  emoji: true,            // ← nuevo
  products: {
    where: { isAvailable: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      isFeatured: true,
      isAvailable: true,
      noteHints: true,    // ← nuevo
      variants: { select: { id: true, name: true, price: true } },
      extras: { select: { id: true, name: true, price: true } },
    },
  },
},
```

- [ ] **Step 3: Agregar método getFeaturedProduct**

Al final de la clase `PublicService`, antes del último `}`, agregar:

```typescript
async getFeaturedProduct(slug: string) {
  const business = await this.prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) throw new BusinessNotFoundPublicException();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const top = await this.prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        businessId: business.id,
        createdAt: { gte: sevenDaysAgo },
        status: { not: 'CANCELLED' },
      },
    },
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 1,
  });

  if (top.length === 0) return null;

  const product = await this.prisma.product.findFirst({
    where: { id: top[0].productId, isAvailable: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      isFeatured: true,
      isAvailable: true,
      noteHints: true,
      variants: { select: { id: true, name: true, price: true } },
      extras: { select: { id: true, name: true, price: true } },
    },
  });

  if (!product) return null;

  return {
    ...product,
    price: Number(product.price),
    variants: product.variants.map((v) => ({ ...v, price: Number(v.price) })),
    extras: product.extras.map((e) => ({ ...e, price: Number(e.price) })),
  };
}
```

- [ ] **Step 4: Compilar**

```bash
cd apps/api && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/public/public.service.ts
git commit -m "feat(api): extend public endpoints with menuColor, emoji, noteHints, featuredProduct"
```

---

## Task 4: PublicController — endpoint de producto destacado

**Files:**
- Modify: `apps/api/src/public/public.controller.ts`

- [ ] **Step 1: Agregar ruta GET :slug/featured-product**

`apps/api/src/public/public.controller.ts`:

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PublicService } from './public.service';

@Controller('public/business')
@Public()
export class PublicController {
  constructor(private publicService: PublicService) {}

  @Get(':slug')
  getBusiness(@Param('slug') slug: string) {
    return this.publicService.getBusiness(slug);
  }

  @Get(':slug/branches')
  getBranches(@Param('slug') slug: string) {
    return this.publicService.getBranches(slug);
  }

  @Get(':slug/categories')
  getCategories(
    @Param('slug') slug: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.publicService.getCategories(slug, branchId);
  }

  @Get(':slug/featured-product')
  getFeaturedProduct(@Param('slug') slug: string) {
    return this.publicService.getFeaturedProduct(slug);
  }

  @Get(':slug/products')
  getProducts(
    @Param('slug') slug: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.publicService.getProducts(slug, categoryId, search);
  }

  @Get(':slug/my-orders')
  getOrdersByPhone(
    @Param('slug') slug: string,
    @Query('phone') phone: string,
  ) {
    return this.publicService.getOrdersByPhone(slug, phone ?? '');
  }
}
```

- [ ] **Step 2: Verificar que el API arranca sin errores**

```bash
cd apps/api && npx ts-node -e "console.log('ok')" 2>&1 | head -5
```

O simplemente compilar:

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Test manual — curl**

Con el API corriendo (`pnpm dev` en la raíz del monorepo):

```bash
curl http://localhost:3001/public/business/cocina-dona-rosa/featured-product
```

Esperado: `null` (si no hay pedidos) o un objeto producto JSON.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/public/public.controller.ts
git commit -m "feat(api): add GET public/business/:slug/featured-product endpoint"
```

---

## Task 5: apps/web — actualizar tipos en lib/api.ts

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Actualizar interfaces y agregar función getFeaturedProduct**

Reemplazar el contenido de `apps/web/src/lib/api.ts` en su totalidad:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface BusinessPublic {
  id: string;
  name: string;
  slug: string;
  description?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  menuColor?: string | null;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
}

export interface ProductExtra {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isFeatured: boolean;
  isAvailable: boolean;
  noteHints: string[];
  variants: ProductVariant[];
  extras: ProductExtra[];
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  emoji?: string;
  products: Product[];
}

export interface MenuPublic {
  business: BusinessPublic;
  categories: Category[];
  featuredProduct: Product | null;
}

export interface CreateOrderItem {
  productId: string;
  variantId?: string;
  extraIds?: string[];
  quantity: number;
  notes?: string;
}

export interface CreateOrderPayload {
  businessId: string;
  branchId?: string | null;
  customer: { name: string; phone: string };
  deliveryType: 'PICKUP' | 'DELIVERY';
  address?: { street: string; references?: string };
  notes?: string;
  deliveryNotes?: string;
  items: CreateOrderItem[];
}

export interface OrderCreatedResponse {
  id: string;
  orderNumber: string;
  status: string;
}

export interface MyOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  itemCount: number;
}

export interface OrderStatusResponse {
  orderNumber: string;
  status: string;
  total: number;
  deliveryType: string;
  items: { name: string; quantity: number; subtotal: number }[];
  createdAt: string;
}

export async function getBusiness(slug: string): Promise<BusinessPublic | null> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getCategories(slug: string): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}/categories`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getFeaturedProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}/featured-product`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getBusinessMenu(slug: string): Promise<MenuPublic | null> {
  try {
    const [business, categories, featuredProduct] = await Promise.all([
      getBusiness(slug),
      getCategories(slug),
      getFeaturedProduct(slug),
    ]);
    if (!business) return null;
    return { business, categories, featuredProduct };
  } catch {
    return null;
  }
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<OrderCreatedResponse> {
  const res = await fetch(`${API_URL}/public/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error('ORDER_FAILED');
  return res.json();
}

export async function getMyOrders(slug: string, phone: string): Promise<MyOrder[]> {
  try {
    const res = await fetch(
      `${API_URL}/public/business/${slug}/my-orders?phone=${encodeURIComponent(phone)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getOrderStatus(
  slug: string,
  orderNumber: string,
): Promise<OrderStatusResponse | null> {
  try {
    const res = await fetch(
      `${API_URL}/public/business/${slug}/orders/${orderNumber}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface PublicBranch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
}

export async function getPublicBranches(slug: string): Promise<PublicBranch[]> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}/branches`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
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

- [ ] **Step 2: Verificar tipos en apps/web**

```bash
cd apps/web && npx tsc --noEmit
```

Esperado: sin errores (habrá errores en el paso siguiente hasta que actualicemos los componentes).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): update public API types with noteHints, emoji, menuColor, featuredProduct"
```

---

## Task 6: apps/web page.tsx — CSS variable + pasar featuredProduct

**Files:**
- Modify: `apps/web/src/app/[slug]/page.tsx`

- [ ] **Step 1: Reemplazar page.tsx**

```typescript
import { notFound } from 'next/navigation';
import { getBusinessMenu, getPublicBranches } from '@/lib/api';
import { BusinessHeader } from '@/components/menu/business-header';
import { ProductList } from '@/components/menu/product-list';
import { CategoryPills } from '@/components/menu/category-pills';
import { CartBar } from '@/components/cart/cart-bar';
import { MenuClient } from './menu-client';

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

  const { business, categories, featuredProduct } = menu;
  const brandColor = THEMES[business.menuColor ?? 'naranja'] ?? THEMES.naranja;
  const selectedBranch = branches.length === 1 ? branches[0] : null;

  return (
    <div style={{ '--brand': brandColor } as React.CSSProperties}>
      <main className="min-h-screen bg-[#F7F8FA]">
        <BusinessHeader
          business={business}
          featuredProduct={featuredProduct}
          selectedBranch={selectedBranch}
          slug={slug}
        />
        <MenuClient branches={branches} />
        <CategoryPills categories={categories} />
        <ProductList categories={categories} slug={slug} />
        <CartBar slug={slug} />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const menu = await getBusinessMenu(slug);
  if (!menu) return {};
  return {
    title: `${menu.business.name} — PideFacil`,
    description: menu.business.description ?? `Pide en ${menu.business.name}`,
  };
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Habrá errores por `BusinessHeader` todavía no actualizado — se resuelven en Task 7.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[slug]/page.tsx
git commit -m "feat(web): inject --brand CSS var and pass featuredProduct to BusinessHeader"
```

---

## Task 7: business-header.tsx — rediseño completo + FeaturedProductButton

**Files:**
- Create: `apps/web/src/components/menu/featured-product-button.tsx`
- Modify: `apps/web/src/components/menu/business-header.tsx`

- [ ] **Step 1: Crear featured-product-button.tsx**

`apps/web/src/components/menu/featured-product-button.tsx`:

```typescript
'use client';

import { Plus } from 'lucide-react';
import { Product } from '@/lib/api';
import { useCartStore } from '@/store/cart.store';
import { formatPrice } from '@/lib/utils';

interface FeaturedProductButtonProps {
  product: Product;
  slug: string;
}

export function FeaturedProductButton({ product, slug }: FeaturedProductButtonProps) {
  const { addItem } = useCartStore();

  const handleAdd = () => {
    addItem(slug, {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      price: product.price,
      extras: [],
    });
  };

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
    >
      <span className="text-xl flex-shrink-0">⭐</span>
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] font-extrabold uppercase tracking-wider"
          style={{ color: 'var(--brand)' }}
        >
          Más pedido hoy
        </p>
        <p className="text-[13px] font-bold text-white truncate mt-0.5">
          {product.name} · {formatPrice(product.price)}
        </p>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--brand)' }}
      >
        <Plus size={16} className="text-white" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar business-header.tsx**

`apps/web/src/components/menu/business-header.tsx`:

```typescript
import Image from 'next/image';
import { BusinessPublic, Product, PublicBranch } from '@/lib/api';
import { MyOrdersButton } from './my-orders-button';
import { FeaturedProductButton } from './featured-product-button';

interface BusinessHeaderProps {
  business: BusinessPublic;
  featuredProduct: Product | null;
  selectedBranch: PublicBranch | null;
  slug: string;
}

export function BusinessHeader({ business, featuredProduct, selectedBranch, slug }: BusinessHeaderProps) {
  const mapsUrl = selectedBranch
    ? `https://maps.google.com/?q=${selectedBranch.latitude},${selectedBranch.longitude}`
    : business.address
      ? `https://maps.google.com/?q=${encodeURIComponent(business.address)}`
      : null;

  const locationLabel = selectedBranch?.address ?? business.address ?? null;

  return (
    <div className="bg-[#1A1A2E] px-4 pt-5 pb-4 space-y-3">
      {/* Negocio: logo + nombre + dirección */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {business.logoUrl ? (
            <Image
              src={business.logoUrl}
              alt={business.name}
              width={44}
              height={44}
              className="rounded-[10px] object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center text-lg font-black text-white flex-shrink-0"
              style={{ background: 'var(--brand)' }}
            >
              {business.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[15px] font-extrabold text-white leading-tight truncate">
              {business.name}
            </h1>
            {locationLabel && (
              mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] mt-0.5 flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--brand)' }}
                >
                  <span>📍</span>
                  <span className="truncate">{locationLabel}</span>
                  <span className="text-[9px] opacity-70 flex-shrink-0">↗</span>
                </a>
              ) : (
                <p className="text-[11px] text-[#8899BB] mt-0.5 truncate">📍 {locationLabel}</p>
              )
            )}
          </div>
        </div>
        <MyOrdersButton slug={business.slug} />
      </div>

      {/* Producto destacado */}
      {featuredProduct && (
        <FeaturedProductButton product={featuredProduct} slug={slug} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "business-header\|featured-product" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/menu/business-header.tsx apps/web/src/components/menu/featured-product-button.tsx
git commit -m "feat(web): redesign business header with dark theme, location link, featured product"
```

---

## Task 8: product-card.tsx — rediseño completo

**Files:**
- Modify: `apps/web/src/components/menu/product-card.tsx`

- [ ] **Step 1: Reemplazar product-card.tsx**

```typescript
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { Product } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart.store';
import { ProductSheet } from './product-sheet';

interface ProductCardProps {
  product: Product;
  slug: string;
  categoryEmoji?: string;
}

export function ProductCard({ product, slug, categoryEmoji }: ProductCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { addItem } = useCartStore();

  const handleAdd = () => {
    if (product.variants.length > 0 || product.extras.length > 0 || product.noteHints.length > 0) {
      setSheetOpen(true);
    } else {
      addItem(slug, {
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price,
        extras: [],
      });
    }
  };

  return (
    <>
      <div className="bg-white rounded-[14px] border border-[#ECEDF0] flex items-center overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        {/* Acento lateral */}
        <div
          className="w-1 self-stretch flex-shrink-0 rounded-l-sm"
          style={{ background: 'var(--brand)' }}
        />

        {/* Info */}
        <div className="flex-1 px-3 py-3 min-w-0">
          <p className="text-[13px] font-bold text-[#1A1A2E] leading-snug">{product.name}</p>
          <p
            className="text-[14px] font-extrabold mt-1.5"
            style={{ color: 'var(--brand)' }}
          >
            {formatPrice(product.price)}
          </p>
        </div>

        {/* Imagen + botón */}
        <div className="pr-3 py-3 flex flex-col items-center gap-1.5 flex-shrink-0">
          {product.imageUrl ? (
            <div className="relative w-[62px] h-[62px] rounded-[10px] overflow-hidden">
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div
              className="w-[62px] h-[62px] rounded-[10px] flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg, var(--brand), #1A1A2E)' }}
            >
              {categoryEmoji ?? ''}
            </div>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center bg-[#1A1A2E] active:scale-95 transition-transform"
          >
            <Plus size={14} className="text-white" />
          </button>
        </div>
      </div>

      <ProductSheet
        key={product.id}
        product={product}
        slug={slug}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
```

**Nota:** El botón `+` ahora también abre el sheet cuando el producto tiene `noteHints`, para que el cliente pueda personalizarlo.

- [ ] **Step 2: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "product-card" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/menu/product-card.tsx
git commit -m "feat(web): redesign product card with accent stripe, gradient placeholder, dark + button"
```

---

## Task 9: product-list.tsx y category-pills.tsx

**Files:**
- Modify: `apps/web/src/components/menu/product-list.tsx`
- Modify: `apps/web/src/components/menu/category-pills.tsx`

- [ ] **Step 1: Reemplazar product-list.tsx**

```typescript
import { Category } from '@/lib/api';
import { ProductCard } from './product-card';

interface ProductListProps {
  categories: Category[];
  slug: string;
}

export function ProductList({ categories, slug }: ProductListProps) {
  const active = categories.filter((c) => c.products.some((p) => p.isAvailable));

  return (
    <div className="pb-32 px-3 pt-3 space-y-5">
      {active.map((category) => (
        <section key={category.id} id={`cat-${category.id}`}>
          {/* Título de categoría */}
          <div className="flex items-center gap-1.5 mb-3 px-1">
            {category.emoji && (
              <span className="text-[15px]">{category.emoji}</span>
            )}
            <span className="text-[11px] font-extrabold text-[#1A1A2E] uppercase tracking-[0.07em]">
              {category.name}
            </span>
          </div>

          {/* Productos */}
          <div className="flex flex-col gap-2">
            {category.products
              .filter((p) => p.isAvailable)
              .map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  slug={slug}
                  categoryEmoji={category.emoji}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Actualizar category-pills.tsx — padding**

En `apps/web/src/components/menu/category-pills.tsx`, en la className del `<button>` del pill activo/inactivo, cambiar `py-1.5` a `py-[5px]` y ajustar colores dinámicos:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Category } from '@/lib/api';

interface CategoryPillsProps {
  categories: Category[];
}

export function CategoryPills({ categories }: CategoryPillsProps) {
  const [activeId, setActiveId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const active = categories.filter((c) => c.products.some((p) => p.isAvailable));

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const activeCategories = categories.filter((c) =>
      c.products.some((p) => p.isAvailable),
    );

    activeCategories.forEach((category) => {
      const section = document.getElementById(`cat-${category.id}`);
      if (!section) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(category.id);
        },
        { rootMargin: '-50% 0px -50% 0px' },
      );
      observer.observe(section);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [categories]);

  const scrollToCategory = (id: string) => {
    const section = document.getElementById(`cat-${id}`);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  if (active.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-3 py-[10px] overflow-x-auto flex gap-2 scrollbar-hide">
      {active.map((category) => {
        const isActive = activeId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => scrollToCategory(category.id)}
            className="flex-shrink-0 px-4 py-[5px] rounded-full text-[11px] font-bold transition-colors"
            style={
              isActive
                ? { background: 'var(--brand)', color: '#fff' }
                : { background: '#F4F4F6', color: '#666' }
            }
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "product-list\|category-pills" | head -5
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/menu/product-list.tsx apps/web/src/components/menu/category-pills.tsx
git commit -m "feat(web): update product list with emoji category headers and themed pills"
```

---

## Task 10: product-sheet.tsx — chips de noteHints

**Files:**
- Modify: `apps/web/src/components/menu/product-sheet.tsx`

- [ ] **Step 1: Agregar estado activeHints y toggleHint**

En `product-sheet.tsx`, después de `const [notes, setNotes] = useState('')`, agregar:

```typescript
const [activeHints, setActiveHints] = useState<string[]>([]);

const toggleHint = (hint: string) => {
  setActiveHints((prev) =>
    prev.includes(hint) ? prev.filter((h) => h !== hint) : [...prev, hint],
  );
};
```

- [ ] **Step 2: Modificar handleAdd para concatenar hints en notes**

Reemplazar la función `handleAdd` existente:

```typescript
const handleAdd = () => {
  if (product.variants.length > 0 && !selectedVariant) return;

  const hintText = activeHints.join(', ');
  const fullNotes = [hintText, notes.trim()].filter(Boolean).join('. ');

  addItem(slug, {
    productId: product.id,
    variantId: selectedVariant?.id,
    variantName: selectedVariant?.name,
    name: product.name,
    imageUrl: product.imageUrl,
    price: unitPrice,
    extras: selectedExtras,
    notes: fullNotes || undefined,
    quantity,
  });
  onClose();
};
```

- [ ] **Step 3: Agregar bloque de chips entre Extras y Notas**

En el JSX de `product-sheet.tsx`, después del bloque `{/* Extras */}` y antes de `{/* Notes */}`, insertar:

```tsx
{/* Note hints */}
{product.noteHints.length > 0 && (
  <div className="mt-4">
    <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
      Personalizar
    </p>
    <div className="flex flex-wrap gap-2">
      {product.noteHints.map((hint) => {
        const isActive = activeHints.includes(hint);
        return (
          <button
            key={hint}
            type="button"
            onClick={() => toggleHint(hint)}
            className="px-3 py-1 rounded-full text-xs font-bold transition-colors border-2"
            style={
              isActive
                ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: 'rgba(var(--brand-rgb, 255 107 53) / 0.08)' }
                : { borderColor: '#E5E7EB', color: '#6B7280', background: '#F9FAFB' }
            }
          >
            {isActive ? `✓ ${hint}` : hint}
          </button>
        );
      })}
    </div>
  </div>
)}
```

**Nota:** El fondo activo usa `rgba(...)` con fallback. Si el CSS variable approach de rgba es complejo, simplificar a `background: isActive ? '#FFF3EE' : '#F9FAFB'` para los chips con tema naranja default, y aceptar que el fondo del chip siempre sea ese tono claro de naranja (es un detalle menor).

Versión simplificada del style activo:

```tsx
style={
  isActive
    ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: '#FFF3EE' }
    : { borderColor: '#E5E7EB', color: '#6B7280', background: '#F9FAFB' }
}
```

- [ ] **Step 4: Verificar tipos**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "product-sheet" | head -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/menu/product-sheet.tsx
git commit -m "feat(web): add noteHints chips to product sheet"
```

---

## Task 11: cart-bar.tsx — fondo oscuro

**Files:**
- Modify: `apps/web/src/components/cart/cart-bar.tsx`

- [ ] **Step 1: Cambiar colores del botón del cart**

En `apps/web/src/components/cart/cart-bar.tsx`, reemplazar la className del `<button>`:

Antes:
```tsx
className="w-full bg-brand-500 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg pointer-events-auto active:scale-[0.98] transition-transform"
```

Después:
```tsx
className="w-full rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg pointer-events-auto active:scale-[0.98] transition-transform bg-[#1A1A2E]"
```

Y el precio, cambiar de `font-bold` a:
```tsx
<span className="font-bold" style={{ color: 'var(--brand)' }}>
  {formatPrice(total())} →
</span>
```

El archivo completo resultante:

```typescript
'use client';

import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { formatPrice } from '@/lib/utils';
import { CartDrawer } from './cart-drawer';

interface CartBarProps {
  slug: string;
}

export function CartBar({ slug }: CartBarProps) {
  const { items, total, itemCount, openDrawer, isDrawerOpen, closeDrawer } =
    useCartStore();

  if (items.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pointer-events-none">
        <button
          type="button"
          onClick={openDrawer}
          className="w-full bg-[#1A1A2E] rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg pointer-events-auto active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2 text-white">
            <ShoppingCart size={20} />
            <span className="font-bold">
              {itemCount()} {itemCount() === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <span className="font-bold" style={{ color: 'var(--brand)' }}>
            {formatPrice(total())} →
          </span>
        </button>
      </div>
      <CartDrawer slug={slug} open={isDrawerOpen} onClose={closeDrawer} />
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos completos de apps/web**

```bash
cd apps/web && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/cart/cart-bar.tsx
git commit -m "feat(web): cart bar dark background with brand-colored price"
```

---

## Task 12: Admin hooks — agregar nuevos campos a interfaces

**Files:**
- Modify: `apps/admin/src/hooks/use-products.ts`
- Modify: `apps/admin/src/hooks/use-categories.ts`
- Modify: `apps/admin/src/hooks/use-business.ts`

- [ ] **Step 1: Agregar noteHints a Product en use-products.ts**

En `apps/admin/src/hooks/use-products.ts`, en la interfaz `Product`, agregar:

```typescript
noteHints: string[];
```

La interfaz completa:

```typescript
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  categoryId: string;
  noteHints: string[];
  variants: Variant[];
  extras: Extra[];
}
```

- [ ] **Step 2: Agregar emoji a Category en use-categories.ts**

En `apps/admin/src/hooks/use-categories.ts`, en la interfaz `Category`, agregar:

```typescript
emoji?: string;
```

La interfaz completa:

```typescript
export interface Category {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  menuId?: string;
  sortOrder: number;
  emoji?: string;
}
```

- [ ] **Step 3: Agregar menuColor a Business en use-business.ts**

En `apps/admin/src/hooks/use-business.ts`, en la interfaz `Business`, agregar:

```typescript
menuColor?: string | null;
```

La interfaz completa:

```typescript
export interface Business {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  description?: string;
  address?: string;
  logoUrl?: string;
  hours?: string;
  menuColor?: string | null;
}
```

- [ ] **Step 4: Verificar tipos en apps/admin**

```bash
cd apps/admin && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/hooks/use-products.ts apps/admin/src/hooks/use-categories.ts apps/admin/src/hooks/use-business.ts
git commit -m "feat(admin): add noteHints, emoji, menuColor to admin hooks interfaces"
```

---

## Task 13: product-form.tsx — campo noteHints + hint de imagen

**Files:**
- Modify: `apps/admin/src/components/menu-designer/product-form.tsx`

- [ ] **Step 1: Actualizar el schema Zod para incluir noteHints**

En `product-form.tsx`, en `productFormSchema`, agregar:

```typescript
noteHints: z.array(z.string()).optional().default([]),
```

El schema completo:

```typescript
const productFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  price: z.number({ error: 'Ingresa un precio válido' }).min(0, 'El precio debe ser mayor o igual a 0'),
  isAvailable: z.boolean(),
  imageUrl: z.string().optional(),
  noteHints: z.array(z.string()).optional().default([]),
});
```

Actualizar el tipo:
```typescript
type ProductFormValues = z.infer<typeof productFormSchema>;
```

- [ ] **Step 2: Agregar noteHintsInput state y lógica de chips**

Después de `const imageUrl = watch('imageUrl');`, agregar:

```typescript
const noteHints = watch('noteHints') ?? [];
const [hintInput, setHintInput] = useState('');

const addHint = () => {
  const trimmed = hintInput.trim();
  if (!trimmed || noteHints.includes(trimmed) || noteHints.length >= 10) return;
  setValue('noteHints', [...noteHints, trimmed], { shouldDirty: true });
  setHintInput('');
};

const removeHint = (hint: string) => {
  setValue('noteHints', noteHints.filter((h) => h !== hint), { shouldDirty: true });
};
```

Agregar `useState` al import de React:
```typescript
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 3: Actualizar defaultValues para incluir noteHints**

En `useForm`, actualizar `defaultValues`:

```typescript
defaultValues: {
  name: product?.name ?? '',
  description: product?.description ?? '',
  price: product?.price ?? 0,
  isAvailable: product?.isAvailable ?? true,
  imageUrl: product?.imageUrl ?? '',
  noteHints: product?.noteHints ?? [],
},
```

Actualizar también el `reset` en `useEffect`:

```typescript
useEffect(() => {
  if (product) {
    reset({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      isAvailable: product.isAvailable,
      imageUrl: product.imageUrl ?? '',
      noteHints: product.noteHints ?? [],
    });
  }
}, [product?.id, reset]);
```

- [ ] **Step 4: Agregar hint de tamaño de imagen y campo noteHints en el JSX**

Después del bloque de imagen (después de `<input ref={fileInputRef} ... />`), agregar:

```tsx
<p className="text-xs text-gray-400 mt-1">
  Recomendado: 400 × 400 px (cuadrada), JPG o PNG, máx 2 MB. Se muestra en 62 × 62 px en el menú.
</p>
```

Después del bloque `{/* Description */}` y antes de `{/* Price */}`, agregar el campo noteHints:

```tsx
{/* Note hints */}
<div>
  <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
    Sugerencias de personalización
  </Label>
  <p className="text-[10px] text-gray-400 mb-2">
    Ej: sin cebolla, con picante. El cliente las toca al pedir.
  </p>
  <div className="flex gap-2">
    <Input
      value={hintInput}
      onChange={(e) => setHintInput(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHint())}
      className="h-9 rounded-xl text-sm flex-1"
      placeholder="sin cebolla"
      maxLength={40}
    />
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={addHint}
      disabled={!hintInput.trim() || noteHints.length >= 10}
      className="h-9 px-3 rounded-xl text-xs"
    >
      + Agregar
    </Button>
  </div>
  {noteHints.length > 0 && (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {noteHints.map((hint) => (
        <span
          key={hint}
          className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2.5 py-1 text-xs font-medium"
        >
          {hint}
          <button
            type="button"
            onClick={() => removeHint(hint)}
            className="text-brand-400 hover:text-brand-700 leading-none"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )}
  {noteHints.length >= 10 && (
    <p className="text-xs text-amber-500 mt-1">Máximo 10 sugerencias</p>
  )}
</div>
```

- [ ] **Step 5: Verificar tipos**

```bash
cd apps/admin && npx tsc --noEmit 2>&1 | grep "product-form" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/menu-designer/product-form.tsx
git commit -m "feat(admin): add noteHints chips field and image size hint to product form"
```

---

## Task 14: category-form.tsx — campo emoji

**Files:**
- Modify: `apps/admin/src/components/menu-designer/category-form.tsx`

- [ ] **Step 1: Agregar emoji al schema Zod**

En `categoryFormSchema`:

```typescript
const categoryFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  emoji: z.string().optional(),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;
```

- [ ] **Step 2: Actualizar defaultValues y useEffect**

En `useForm`:
```typescript
defaultValues: { name: category.name, status: category.status, emoji: category.emoji ?? '' },
```

En `useEffect`:
```typescript
reset({ name: category.name, status: category.status, emoji: category.emoji ?? '' });
```

- [ ] **Step 3: Agregar campo emoji en el JSX**

Después del campo "Estado" y antes de `<Separator />`, agregar:

```tsx
<div>
  <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
    Emoji (opcional)
  </Label>
  <Input
    {...register('emoji')}
    className="h-11 rounded-xl w-24 text-2xl text-center"
    placeholder="🍲"
    maxLength={2}
  />
  <p className="text-[10px] text-gray-400 mt-1">
    Se muestra junto al nombre de la categoría en el menú
  </p>
</div>
```

- [ ] **Step 4: Verificar tipos**

```bash
cd apps/admin && npx tsc --noEmit 2>&1 | grep "category-form" | head -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/menu-designer/category-form.tsx
git commit -m "feat(admin): add emoji field to category form"
```

---

## Task 15: business-form.tsx — selector de tema de color

**Files:**
- Modify: `apps/admin/src/components/settings/business-form.tsx`

- [ ] **Step 1: Agregar menuColor al schema Zod**

```typescript
const MENU_COLOR_KEYS = ['naranja','verde','rojo','azul','morado','rosa','dorado','turquesa'] as const;
type MenuColorKey = typeof MENU_COLOR_KEYS[number];

const businessFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  description: z.string().optional(),
  hours: z.string().optional(),
  menuColor: z.enum(MENU_COLOR_KEYS).optional(),
});
type BusinessFormValues = z.infer<typeof businessFormSchema>;
```

- [ ] **Step 2: Agregar catálogo de temas**

Antes del componente, agregar:

```typescript
const THEMES: { key: MenuColorKey; name: string; hex: string; emoji: string }[] = [
  { key: 'naranja',  name: 'Naranja',  hex: '#FF6B35', emoji: '🔥' },
  { key: 'verde',    name: 'Verde',    hex: '#27AE60', emoji: '🌿' },
  { key: 'rojo',     name: 'Rojo',     hex: '#E74C3C', emoji: '🌶️' },
  { key: 'azul',     name: 'Azul',     hex: '#2980B9', emoji: '💙' },
  { key: 'morado',   name: 'Morado',   hex: '#8E44AD', emoji: '💜' },
  { key: 'rosa',     name: 'Rosa',     hex: '#E91E8C', emoji: '🌸' },
  { key: 'dorado',   name: 'Dorado',   hex: '#F39C12', emoji: '✨' },
  { key: 'turquesa', name: 'Turquesa', hex: '#16A085', emoji: '🌊' },
];
```

- [ ] **Step 3: Actualizar defaultValues, reset y onSubmit**

En `defaultValues`:
```typescript
defaultValues: {
  name: '',
  slug: '',
  phone: '',
  address: '',
  logoUrl: '',
  description: '',
  hours: '',
  menuColor: undefined,
},
```

En `useEffect` (reset cuando carga business):
```typescript
reset({
  name: business.name,
  slug: business.slug,
  phone: business.phone ?? '',
  address: business.address ?? '',
  logoUrl: business.logoUrl ?? '',
  description: business.description ?? '',
  hours: business.hours ?? '',
  menuColor: (business.menuColor as MenuColorKey | undefined) ?? undefined,
});
```

- [ ] **Step 4: Agregar swatch picker en el JSX**

Agregar `watch` al destructuring de `useForm`:
```typescript
const {
  register,
  handleSubmit,
  reset,
  watch,
  setValue,
  formState: { errors, isDirty, isSubmitting },
} = useForm<BusinessFormValues>({ ... });

const selectedColor = watch('menuColor');
```

Antes del botón de guardar, agregar la sección de apariencia:

```tsx
{/* Apariencia del menú */}
<div>
  <Label className="text-xs font-semibold text-gray-600 mb-2 block">
    Color del menú
  </Label>
  <p className="text-[10px] text-gray-400 mb-3">
    Este color se usa en el acento, precios y botones de tu menú QR.
  </p>
  <div className="grid grid-cols-4 gap-2">
    {THEMES.map((theme) => {
      const isSelected = selectedColor === theme.key || (!selectedColor && theme.key === 'naranja');
      return (
        <button
          key={theme.key}
          type="button"
          onClick={() => setValue('menuColor', theme.key, { shouldDirty: true })}
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all"
          style={{
            borderColor: isSelected ? theme.hex : 'transparent',
            background: isSelected ? `${theme.hex}10` : '#F9FAFB',
          }}
        >
          <div
            className="w-8 h-8 rounded-full"
            style={{ background: theme.hex }}
          />
          <span className="text-[10px] font-semibold text-gray-600 leading-tight text-center">
            {theme.emoji} {theme.name}
          </span>
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 5: Verificar tipos en apps/admin**

```bash
cd apps/admin && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/settings/business-form.tsx
git commit -m "feat(admin): add menu color theme picker to business settings"
```

---

## Verificación final

- [ ] **Compilación limpia de los 3 apps**

```bash
cd /ruta/del/monorepo
pnpm --filter @pidefacil/api tsc --noEmit
pnpm --filter @pidefacil/web tsc --noEmit
pnpm --filter @pidefacil/admin tsc --noEmit
```

- [ ] **Smoke test visual — menú QR**

1. Acceder a `http://localhost:3000/cocina-dona-rosa`
2. Verificar: header oscuro con logo cuadrado naranja
3. Verificar: bloque "Más pedido hoy" (si hay pedidos en los últimos 7 días) o ausente si no hay
4. Verificar: dirección como link clickeable
5. Verificar: tarjetas con acento naranja izquierdo
6. Verificar: placeholder con gradiente naranja → oscuro + emoji de categoría
7. Verificar: cart bar oscuro al agregar un producto

- [ ] **Smoke test visual — admin**

1. Ir a Configuración → Mi negocio → ver selector de colores de 8 temas
2. Seleccionar "Verde" → Guardar
3. Recargar el menú QR → verificar que el acento cambió a verde
4. Ir al diseñador de menú → editar una categoría → asignar emoji 🍲 → guardar
5. En el menú QR verificar que el título de categoría muestra el emoji
6. Editar un producto → agregar sugerencias "sin cebolla", "con picante" → guardar
7. En el menú QR tocar el producto → verificar chips "sin cebolla" y "con picante"
8. Seleccionar "sin cebolla" → verificar que se agrega a las notas

- [ ] **Commit de cierre**

```bash
git tag v0.7.0
git push origin main --tags
```
