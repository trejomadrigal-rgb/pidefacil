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
        aria-label="Disminuir cantidad"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
      >
        –
      </button>
      <span className="w-4 text-center text-sm font-semibold">{value}</span>
      <button
        type="button"
        aria-label="Aumentar cantidad"
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
