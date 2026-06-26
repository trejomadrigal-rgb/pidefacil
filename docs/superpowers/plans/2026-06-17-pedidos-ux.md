# Mejoras UX de Pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tres mejoras al flujo de pedidos: (1) botón para crear pedido desde la admin, (2) chips de notas rápidas en el checkout QR, (3) eliminar botón WhatsApp redundante en pantalla post-pedido.

**Architecture:** Cambios exclusivamente en `apps/admin` y `apps/web`. Sin cambios en `apps/api` — todos los endpoints ya existen. El Sheet de creación en admin reutiliza `POST /public/orders`, el mismo endpoint que usa el QR público.

**Tech Stack:** Next.js 15 App Router, React, TanStack Query, Zustand, shadcn/ui (Sheet, Dialog), react-hook-form, axios, Tailwind CSS.

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `apps/web/src/app/[slug]/pedido-enviado/page.tsx` | Modificar — eliminar botón WhatsApp, actualizar texto |
| `apps/web/src/components/checkout/checkout-form.tsx` | Modificar — agregar chips de notas |
| `apps/admin/src/api/orders.ts` | Modificar — agregar `createManualOrder` |
| `apps/admin/src/components/orders/create-order-sheet.tsx` | **Crear** — Sheet completo de nuevo pedido |
| `apps/admin/src/app/(admin)/pedidos/page.tsx` | Modificar — botón + integrar Sheet |

---

## Task 1: Eliminar botón WhatsApp en pantalla post-pedido

**Files:**
- Modify: `apps/web/src/app/[slug]/pedido-enviado/page.tsx`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```tsx
'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

function PedidoEnviadoContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const folio = searchParams.get('folio') ?? '';
  const slug = params.slug;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 280, delay: 0.05 }}
          className="text-6xl mb-4"
        >
          🎉
        </motion.div>

        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 340, delay: 0.2 }}
          className="text-4xl font-black text-green-500 mb-2"
        >
          Pedido #{folio}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.35 }}
        >
          <h1 className="text-xl font-bold text-brand-900 mb-2">
            ¡Pedido enviado!
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Te avisaremos por WhatsApp cuando tu pedido sea confirmado.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.48 }}
          className="space-y-3"
        >
          <Link
            href={`/${slug}/pedido/${folio}`}
            className="flex items-center justify-center w-full bg-brand-500 text-white rounded-xl py-3 font-semibold text-sm"
          >
            📋 Ver estado del pedido
          </Link>
          <Link
            href={`/${slug}`}
            className="flex items-center justify-center w-full text-gray-500 py-2 text-sm"
          >
            ← Volver al menú
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

export default function PedidoEnviadoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <PedidoEnviadoContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verificar que TypeScript no tiene errores**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/web exec tsc --noEmit
```

Expected: Sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[slug\]/pedido-enviado/page.tsx
git commit -m "feat(web): quitar botón WhatsApp redundante en pedido-enviado, promover Ver estado"
```

---

## Task 2: Chips de notas rápidas en checkout QR

**Files:**
- Modify: `apps/web/src/components/checkout/checkout-form.tsx`

El campo `notes` está registrado con react-hook-form. Se usa `watch('notes')` para leer el valor actual y `setValue('notes', ...)` para modificarlo al hacer click en un chip.

- [ ] **Step 1: Agregar constante de tags y helper `toggleTag` antes de `CheckoutForm`**

En `apps/web/src/components/checkout/checkout-form.tsx`, agrega esto justo antes de la declaración de `CheckoutForm` (después de las interfaces, ~línea 43):

```tsx
const NOTE_TAGS = [
  'Sin picante',
  'Sin cebolla',
  'Sin cilantro',
  'Extra salsa',
  'Sin chile',
  'Poca sal',
  'Sin queso',
  'Para llevar',
];

function toggleTag(current: string | undefined, tag: string): string {
  const value = current ?? '';
  const lower = value.toLowerCase();
  const tagLower = tag.toLowerCase();

  if (lower.includes(tagLower)) {
    // Eliminar el tag y limpiar comas/espacios residuales
    return value
      .replace(new RegExp(`,?\\s*${tag}\\s*,?`, 'i'), (match) => {
        // Si había coma antes Y después, conservar una sola
        if (match.startsWith(',') && match.endsWith(',')) return ', ';
        return '';
      })
      .replace(/^,\s*/, '')   // coma inicial
      .replace(/,\s*$/, '')   // coma final
      .trim();
  }

  // Agregar el tag
  return value.trim() ? `${value.trim()}, ${tag}` : tag;
}
```

- [ ] **Step 2: Agregar `watch` al destructuring de `useForm`**

Busca la línea que dice:
```tsx
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
```

`watch` ya está presente. Agrega una variable que lea el valor de notas:

```tsx
  const notesValue = watch('notes');
```

Agrégala justo debajo de `const deliveryType = watch('deliveryType');` (~línea 63).

- [ ] **Step 3: Reemplazar la sección de Notas con chips + textarea**

Busca y reemplaza el bloque de notas (~líneas 297-305):

**Antes:**
```tsx
      {/* Notes */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <textarea
          {...register('notes')}
          placeholder="Notas del pedido (opcional)"
          rows={2}
          className="w-full text-sm resize-none focus:outline-none"
        />
      </div>
```

**Después:**
```tsx
      {/* Notes */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <p className="text-xs text-gray-400 mb-2">Personaliza tu pedido</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {NOTE_TAGS.map((tag) => {
            const isActive = (notesValue ?? '').toLowerCase().includes(tag.toLowerCase());
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setValue('notes', toggleTag(notesValue, tag), { shouldValidate: false })}
                className={`text-xs rounded-full px-3 py-1 transition-colors ${
                  isActive
                    ? 'border border-brand-500 bg-brand-50 text-brand-700'
                    : 'border border-gray-200 bg-white text-gray-600'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <textarea
          {...register('notes')}
          placeholder="O escribe tus indicaciones..."
          rows={2}
          className="w-full text-sm resize-none focus:outline-none text-gray-700 placeholder:text-gray-400"
        />
      </div>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/web exec tsc --noEmit
```

Expected: Sin errores.

- [ ] **Step 5: Verificación manual**

Abre el menú QR → agrega un producto → checkout. En la sección de notas:
- Toca "Sin picante" → debe aparecer resaltado y el textarea debe mostrar "Sin picante"
- Toca "Sin cebolla" → textarea debe mostrar "Sin picante, Sin cebolla"
- Toca "Sin picante" de nuevo → debe desactivarse y textarea quedar "Sin cebolla"
- Escribe texto libre en el textarea → los chips deben reflejar el estado correcto

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/checkout/checkout-form.tsx
git commit -m "feat(web): chips de notas rápidas en checkout (sin picante, sin cebolla, etc.)"
```

---

## Task 3: Función createManualOrder en admin API

**Files:**
- Modify: `apps/admin/src/api/orders.ts`

- [ ] **Step 1: Agregar la función al final de `apps/admin/src/api/orders.ts`**

```typescript
export interface CreateManualOrderPayload {
  businessId: string;
  customer: { name: string; phone: string };
  deliveryType: 'PICKUP' | 'DELIVERY';
  address?: { street: string; references?: string };
  notes?: string;
  paymentMethodId?: string;
  items: { productId: string; variantId?: string; quantity: number }[];
}

export interface CreateManualOrderResult {
  id: string;
  orderNumber: string;
  status: string;
}

// POST /public/orders — crear pedido manual desde admin (mismo endpoint que el QR)
export const createManualOrder = (payload: CreateManualOrderPayload): Promise<CreateManualOrderResult> =>
  api.post('/public/orders', payload).then((r) => r.data);
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/admin exec tsc --noEmit
```

Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/api/orders.ts
git commit -m "feat(admin): agregar createManualOrder al cliente de API"
```

---

## Task 4: Componente CreateOrderSheet

**Files:**
- Create: `apps/admin/src/components/orders/create-order-sheet.tsx`

Este componente contiene todo el Sheet. Lee `businessId` y `businessSlug` del auth store. Carga el menú con `GET /public/business/:slug/categories` (endpoint público, no necesita auth). Carga payment methods con `getPaymentMethods()`.

- [ ] **Step 1: Crear el archivo completo**

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getPaymentMethods } from '@/api/payment-methods';
import { createManualOrder, type CreateManualOrderPayload } from '@/api/orders';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Variant { id: string; name: string; price: number }
interface Product { id: string; name: string; price: number; isAvailable: boolean; variants: Variant[] }
interface Category { id: string; name: string; emoji: string | null; products: Product[] }

interface CustomerInfo {
  name: string;
  totalOrders: number;
  found: boolean;
}

interface SelectedItem {
  quantity: number;
  variantId: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return `$${n.toFixed(2)}`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function QuantityControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
      >
        –
      </button>
      <span className="w-4 text-center text-sm font-semibold">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600"
      >
        +
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface CreateOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrderSheet({ open, onOpenChange }: CreateOrderSheetProps) {
  const qc = useQueryClient();
  const { businessId, businessSlug } = useAuthStore();

  // ── Form state ──
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [deliveryType, setDeliveryType] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [street, setStreet] = useState('');
  const [references, setReferences] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');

  // ── Data fetching ──
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['public-categories', businessSlug],
    queryFn: async () => {
      const { data } = await api.get(`/public/business/${businessSlug}/categories`);
      return data;
    },
    enabled: open && !!businessSlug,
    staleTime: 60_000,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: getPaymentMethods,
    enabled: open,
    staleTime: 60_000,
  });

  // ── Customer lookup ──
  const lookupCustomer = useCallback(async (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 10) return;
    setLookingUp(true);
    try {
      const { data } = await api.get<{ data: { name: string; totalOrders: number }[] }>(
        '/customers',
        { params: { search: digits, limit: 1 } },
      );
      const customer = data.data[0];
      if (customer) {
        setCustomerName(customer.name);
        setCustomerInfo({ name: customer.name, totalOrders: customer.totalOrders, found: true });
      } else {
        setCustomerName('');
        setCustomerInfo({ name: '', totalOrders: 0, found: false });
      }
    } catch {
      setCustomerInfo(null);
    } finally {
      setLookingUp(false);
    }
  }, []);

  // ── Selected items helpers ──
  const setQuantity = (productId: string, quantity: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (quantity === 0) {
        next.delete(productId);
      } else {
        const existing = next.get(productId);
        next.set(productId, { quantity, variantId: existing?.variantId ?? null });
      }
      return next;
    });
  };

  const setVariant = (productId: string, variantId: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (existing) next.set(productId, { ...existing, variantId });
      return next;
    });
  };

  const totalItems = Array.from(selected.values()).reduce((s, i) => s + i.quantity, 0);

  const totalPrice = Array.from(selected.entries()).reduce((sum, [productId, item]) => {
    const product = categories
      .flatMap((c) => c.products)
      .find((p) => p.id === productId);
    if (!product) return sum;
    const variant = item.variantId
      ? product.variants.find((v) => v.id === item.variantId)
      : null;
    const price = variant?.price ?? product.price;
    return sum + price * item.quantity;
  }, 0);

  // ── Validation ──
  const missingVariants = Array.from(selected.entries()).some(([productId, item]) => {
    const product = categories.flatMap((c) => c.products).find((p) => p.id === productId);
    return product && product.variants.length > 0 && !item.variantId;
  });

  const canSubmit =
    phone.replace(/\D/g, '').length === 10 &&
    customerName.trim().length >= 2 &&
    totalItems > 0 &&
    !missingVariants &&
    (deliveryType === 'PICKUP' || street.trim().length >= 3);

  // ── Mutation ──
  const { mutate: submit, isPending } = useMutation({
    mutationFn: (payload: CreateManualOrderPayload) => createManualOrder(payload),
    onSuccess: (result) => {
      toast.success(`Pedido #${result.orderNumber} creado`);
      qc.invalidateQueries({ queryKey: ['orders'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo crear el pedido';
      toast.error(msg);
    },
  });

  const handleSubmit = () => {
    if (!businessId || !canSubmit) return;
    const items = Array.from(selected.entries()).map(([productId, item]) => ({
      productId,
      variantId: item.variantId ?? undefined,
      quantity: item.quantity,
    }));
    submit({
      businessId,
      customer: { name: customerName.trim(), phone: phone.replace(/\D/g, '') },
      deliveryType,
      address:
        deliveryType === 'DELIVERY' && street
          ? { street: street.trim(), references: references.trim() || undefined }
          : undefined,
      notes: notes.trim() || undefined,
      paymentMethodId: paymentMethodId || undefined,
      items,
    });
  };

  // ── Reset on close ──
  const handleClose = () => {
    setPhone('');
    setCustomerName('');
    setCustomerInfo(null);
    setSelected(new Map());
    setDeliveryType('PICKUP');
    setStreet('');
    setReferences('');
    setNotes('');
    setPaymentMethodId('');
    onOpenChange(false);
  };

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500';

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b border-gray-100">
          <SheetTitle className="font-jakarta text-lg font-extrabold text-brand-900">
            Nuevo pedido
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pb-32">

          {/* ① Datos del cliente */}
          <section>
            <h3 className="text-sm font-bold text-brand-900 mb-3">① Datos del cliente</h3>

            <div className="space-y-3">
              <div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => lookupCustomer(phone)}
                  placeholder="Teléfono (10 dígitos)"
                  className={inputCls}
                />
                {lookingUp && (
                  <p className="text-xs text-gray-400 mt-1">Buscando cliente…</p>
                )}
                {customerInfo && !lookingUp && (
                  <p className={cn('text-xs mt-1', customerInfo.found ? 'text-green-600' : 'text-gray-400')}>
                    {customerInfo.found
                      ? `✓ Cliente conocido · ${customerInfo.totalOrders} pedido${customerInfo.totalOrders !== 1 ? 's' : ''}`
                      : 'Cliente nuevo'}
                  </p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* ② Productos */}
          <section>
            <h3 className="text-sm font-bold text-brand-900 mb-3">② Productos</h3>

            {categories.length === 0 ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((cat) => {
                  const available = cat.products.filter((p) => p.isAvailable);
                  if (available.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                        {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                      </p>
                      <div className="space-y-3">
                        {available.map((product) => {
                          const item = selected.get(product.id);
                          const qty = item?.quantity ?? 0;
                          return (
                            <div key={product.id} className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800">{product.name}</p>
                                <p className="text-xs text-brand-500 font-bold">
                                  {formatPrice(product.price)}
                                </p>
                                {/* Variant selector — only shown when qty > 0 and variants exist */}
                                {qty > 0 && product.variants.length > 0 && (
                                  <select
                                    value={item?.variantId ?? ''}
                                    onChange={(e) => setVariant(product.id, e.target.value)}
                                    className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-500"
                                  >
                                    <option value="">Elige variante…</option>
                                    {product.variants.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.name} — {formatPrice(v.price)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              <QuantityControl
                                value={qty}
                                onChange={(v) => setQuantity(product.id, v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ③ Tipo de entrega */}
          <section>
            <h3 className="text-sm font-bold text-brand-900 mb-3">③ Tipo de entrega</h3>
            <div className="flex gap-3 mb-3">
              {(['PICKUP', 'DELIVERY'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDeliveryType(type)}
                  className={cn(
                    'flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-colors',
                    deliveryType === type
                      ? 'border-brand-500 bg-brand-50 text-brand-500'
                      : 'border-gray-200 text-gray-500',
                  )}
                >
                  {type === 'PICKUP' ? '🏃 Recoger en tienda' : '🛵 A domicilio'}
                </button>
              ))}
            </div>
            {deliveryType === 'DELIVERY' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Dirección (calle y número)"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={references}
                  onChange={(e) => setReferences(e.target.value)}
                  placeholder="Referencias (opcional)"
                  className={inputCls}
                />
              </div>
            )}
          </section>

          {/* ④ Pago y notas */}
          <section>
            <h3 className="text-sm font-bold text-brand-900 mb-3">④ Pago y notas</h3>
            <div className="space-y-3">
              {paymentMethods.filter((m) => m.isActive).length > 0 && (
                <div className="space-y-2">
                  {paymentMethods
                    .filter((m) => m.isActive)
                    .map((method) => (
                      <label
                        key={method.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors',
                          paymentMethodId === method.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-100 hover:border-gray-200',
                        )}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={paymentMethodId === method.id}
                          onChange={() => setPaymentMethodId(method.id)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border-2 flex-shrink-0',
                            paymentMethodId === method.id
                              ? 'border-brand-500 bg-brand-500'
                              : 'border-gray-300',
                          )}
                        />
                        <span className={cn('text-sm font-semibold', paymentMethodId === method.id ? 'text-brand-900' : 'text-gray-700')}>
                          {method.label}
                        </span>
                      </label>
                    ))}
                </div>
              )}

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas del pedido (opcional)"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-brand-500"
              />
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <div className="border-t border-gray-100 px-6 py-4 bg-white">
          {totalItems > 0 && (
            <p className="text-xs text-gray-400 text-center mb-2">
              {totalItems} producto{totalItems !== 1 ? 's' : ''} · {formatPrice(totalPrice)}
            </p>
          )}
          {missingVariants && (
            <p className="text-xs text-red-500 text-center mb-2">
              Elige la variante de todos los productos seleccionados
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="w-full bg-brand-500 text-white rounded-2xl py-3 font-bold text-sm disabled:opacity-40"
          >
            {isPending ? 'Creando pedido…' : 'Crear pedido'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/admin exec tsc --noEmit
```

Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/orders/create-order-sheet.tsx
git commit -m "feat(admin): CreateOrderSheet — Sheet para captura manual de pedidos"
```

---

## Task 5: Integrar CreateOrderSheet en la página de pedidos

**Files:**
- Modify: `apps/admin/src/app/(admin)/pedidos/page.tsx`

- [ ] **Step 1: Agregar imports y estado `createOpen`**

En `apps/admin/src/app/(admin)/pedidos/page.tsx`, modifica la sección de imports y el inicio de `PedidosPage`:

**Agrega al bloque de imports** (al final de los imports existentes):
```tsx
import { Plus } from 'lucide-react';
import { CreateOrderSheet } from '@/components/orders/create-order-sheet';
```

**Agrega `createOpen` state** dentro de `PedidosPage`, justo después de la declaración de `loadingId`:
```tsx
  const [createOpen, setCreateOpen] = useState(false);
```

- [ ] **Step 2: Agregar el botón al header y el Sheet al return**

Busca la línea del `<h1>` en el return (~línea 148):

**Antes:**
```tsx
      <h1 className="font-jakarta text-2xl font-extrabold text-brand-900 mb-6">Pedidos de hoy</h1>
```

**Después:**
```tsx
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-jakarta text-2xl font-extrabold text-brand-900">Pedidos de hoy</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors"
        >
          <Plus size={16} />
          Nuevo pedido
        </button>
      </div>
```

Agrega el Sheet **justo antes del `</div>` de cierre del return** (antes del último `</div>`):
```tsx
      <CreateOrderSheet open={createOpen} onOpenChange={setCreateOpen} />
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/alextrejo/Desktop/Claude/pidefacil
pnpm --filter @pidefacil/admin exec tsc --noEmit
```

Expected: Sin errores.

- [ ] **Step 4: Verificación manual**

1. Abre la admin → sección Pedidos
2. Debe aparecer el botón "Nuevo pedido" en la esquina superior derecha del header
3. Al hacer click debe abrirse el Sheet lateral
4. Escribe un teléfono de 10 dígitos y haz tab → debe mostrar "Cliente conocido · N pedidos" o "Cliente nuevo"
5. Agrega productos con los botones + y –
6. Si un producto tiene variantes, verifica que aparece el selector al agregar cantidad
7. Cambia a "A domicilio" → deben aparecer los campos de dirección
8. Haz click en "Crear pedido" → debe aparecer toast "Pedido #N creado" y la lista debe refrescarse

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/\(admin\)/pedidos/page.tsx
git commit -m "feat(admin): botón Nuevo pedido en lista de pedidos + integración CreateOrderSheet"
```

---

## Task 6: Deploy

- [ ] **Step 1: Push a main para trigger CI/CD**

```bash
git push origin main
```

Expected: GitHub Actions inicia el pipeline. Monitorea en `https://github.com/trejomadrigal-rgb/pidefacil/actions`.

- [ ] **Step 2: Verificar deploy de web**

Una vez desplegado, abre `http://b10i6rz52rphphtcnxll73np.2.24.201.108.sslip.io/dona-rosa` y completa un pedido de prueba. Verifica:
- Los chips de notas aparecen en el checkout
- La pantalla post-pedido no tiene el botón de WhatsApp
- El botón "Ver estado del pedido" es naranja (brand-500)

- [ ] **Step 3: Verificar deploy de admin**

Abre el admin → Pedidos. Verifica:
- El botón "Nuevo pedido" aparece en el header
- El Sheet abre y funciona completo
