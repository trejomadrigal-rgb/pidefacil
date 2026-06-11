'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCartStore } from '@/store/cart.store';
import { createOrder } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

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
}

export function CheckoutForm({ slug, businessId }: CheckoutFormProps) {
  const { items, total, clearCart } = useCartStore();
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { deliveryType: 'PICKUP' },
  });

  const deliveryType = watch('deliveryType');

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    try {
      const result = await createOrder({
        businessId,
        customer: { name: values.name, phone: values.phone },
        deliveryType: values.deliveryType,
        address:
          values.deliveryType === 'DELIVERY' && values.street
            ? { street: values.street, references: values.references }
            : undefined,
        notes: values.notes,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          extraIds: i.extras.map((e) => e.id),
          quantity: i.quantity,
          notes: i.notes,
        })),
      });
      clearCart();
      router.push(
        `/${slug}/pedido-enviado?folio=${result.orderNumber}&phone=${values.phone}`,
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
          </div>
        )}
      </div>

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
