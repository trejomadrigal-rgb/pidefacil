'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCartStore } from '@/store/cart.store';
import { createOrder, type PublicPaymentMethod } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

const PROFILE_KEY = 'pidefacil_guest_profile';

const schema = z
  .object({
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    phone: z
      .string()
      .regex(/^\d{10}$/, '10 dígitos sin espacios ni guiones'),
    deliveryType: z.enum(['PICKUP', 'DELIVERY']),
    street: z.string().optional(),
    references: z.string().optional(),
    notes: z.string().optional(),
    deliveryNotes: z.string().max(300).optional(),
  })
  .refine(
    (data) => {
      if (data.deliveryType === 'DELIVERY') {
        return !!data.street && data.street.trim().length >= 3;
      }
      return true;
    },
    { message: 'La dirección es requerida para delivery', path: ['street'] },
  );

type FormValues = z.infer<typeof schema>;

interface CheckoutFormProps {
  slug: string;
  businessId: string;
  businessPhone?: string;
  paymentMethods: PublicPaymentMethod[];
  onSubmitted?: () => void;
}

export function CheckoutForm({ slug, businessId, businessPhone, paymentMethods, onSubmitted }: CheckoutFormProps) {
  const { items, total, clearCart, branchId } = useCartStore();
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { deliveryType: 'PICKUP' },
  });

  const deliveryType = watch('deliveryType');

  // Pre-fill from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const profile = JSON.parse(raw) as {
          name?: string;
          phone?: string;
          deliveryNotes?: string;
        };
        if (profile.name) setValue('name', profile.name);
        if (profile.phone) setValue('phone', profile.phone);
        if (profile.deliveryNotes) setValue('deliveryNotes', profile.deliveryNotes);
      }
    } catch {
      // ignore malformed data
    }
  }, [setValue]);

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    if (paymentMethods.length > 0 && !selectedPaymentMethodId) {
      setErrorMsg('Selecciona una forma de pago para continuar');
      return;
    }
    try {
      const result = await createOrder({
        businessId,
        branchId: branchId ?? undefined,
        customer: { name: values.name, phone: values.phone },
        deliveryType: values.deliveryType,
        address:
          values.deliveryType === 'DELIVERY' && values.street
            ? { street: values.street, references: values.references }
            : undefined,
        notes: values.notes,
        deliveryNotes: values.deliveryNotes || undefined,
        paymentMethodId: selectedPaymentMethodId || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          extraIds: i.extras.map((e) => e.id),
          quantity: i.quantity,
          notes: i.notes,
        })),
      });
      // Persist customer profile for next visit
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ name: values.name, phone: values.phone, deliveryNotes: values.deliveryNotes }),
      );
      onSubmitted?.();
      clearCart();
      router.push(
        `/${slug}/pedido-enviado?folio=${result.orderNumber}&phone=${values.phone}&businessPhone=${encodeURIComponent(businessPhone ?? '')}`,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'RATE_LIMIT') {
        setErrorMsg('Demasiados pedidos, espera un momento');
      } else {
        setErrorMsg('Error al enviar el pedido, intenta de nuevo');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-10">
      {/* Order summary */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <h2 className="font-bold text-brand-900 mb-3">Resumen del pedido</h2>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.productId}:${item.variantId ?? ''}`}
              className="flex justify-between text-sm"
            >
              <span className="text-gray-700">
                {item.name}
                {item.variantName && ` · ${item.variantName}`} ×{item.quantity}
              </span>
              <span className="font-semibold text-gray-800">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-brand-500">{formatPrice(total())}</span>
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm space-y-3">
        <h2 className="font-bold text-brand-900">Tus datos</h2>

        <div>
          <input
            {...register('name')}
            placeholder="Tu nombre"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <input
            {...register('phone')}
            placeholder="Teléfono (10 dígitos)"
            inputMode="numeric"
            maxLength={10}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
          />
          {errors.phone && (
            <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
          )}
        </div>
      </div>

      {/* Delivery type */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <h2 className="font-bold text-brand-900 mb-3">Tipo de entrega</h2>
        <div className="flex gap-3">
          <label className="flex-1 cursor-pointer">
            <input
              {...register('deliveryType')}
              type="radio"
              value="PICKUP"
              className="sr-only"
            />
            <div
              className={`text-center py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                deliveryType === 'PICKUP'
                  ? 'border-brand-500 bg-brand-50 text-brand-500'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              🏃 Recoger
            </div>
          </label>
          <label className="flex-1 cursor-pointer">
            <input
              {...register('deliveryType')}
              type="radio"
              value="DELIVERY"
              className="sr-only"
            />
            <div
              className={`text-center py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                deliveryType === 'DELIVERY'
                  ? 'border-brand-500 bg-brand-50 text-brand-500'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              🛵 Delivery
            </div>
          </label>
        </div>

        {deliveryType === 'DELIVERY' && (
          <div className="mt-3 space-y-2">
            <input
              {...register('street')}
              placeholder="Dirección (calle y número)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
            />
            {errors.street && (
              <p className="text-red-500 text-xs">{errors.street.message}</p>
            )}
            <input
              {...register('references')}
              placeholder="Referencias (opcional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
            />
            <textarea
              {...register('deliveryNotes')}
              placeholder="Indicaciones para tu entrega (opcional) — Ej: Edificio Azul, preguntar en recepción del 3er piso"
              rows={2}
              maxLength={300}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-brand-500"
            />
          </div>
        )}
      </div>

      {/* Payment method */}
      {paymentMethods.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-brand-900 mb-3">¿Cómo vas a pagar?</h2>
          <div className="space-y-2">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                  selectedPaymentMethodId === method.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={selectedPaymentMethodId === method.id}
                  onChange={() => setSelectedPaymentMethodId(method.id)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                    selectedPaymentMethodId === method.id
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-gray-300'
                  }`}
                />
                <div>
                  <p className={`text-sm font-semibold ${selectedPaymentMethodId === method.id ? 'text-brand-900' : 'text-gray-700'}`}>
                    {method.label}
                  </p>
                  {method.requiresConfirmation && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Se te pedirá comprobante antes de preparar tu pedido
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <textarea
          {...register('notes')}
          placeholder="Notas del pedido (opcional)"
          rows={2}
          className="w-full text-sm resize-none focus:outline-none"
        />
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-brand-900 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60"
      >
        {isSubmitting ? 'Enviando...' : 'Confirmar pedido'}
      </button>
    </form>
  );
}
