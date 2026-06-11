'use client';

import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useCartStore } from '@/store/cart.store';
import { formatPrice } from '@/lib/utils';

interface CartDrawerProps {
  slug: string;
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ slug, open, onClose }: CartDrawerProps) {
  const { items, total, removeItem, updateQuantity } = useCartStore();
  const router = useRouter();

  const handleCheckout = () => {
    onClose();
    router.push(`/${slug}/checkout`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[75vh] flex flex-col focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <Dialog.Title className="text-base font-bold text-brand-900">
              Tu pedido
            </Dialog.Title>
            <Dialog.Close className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {items.map((item) => (
              <div
                key={`${item.productId}:${item.variantId ?? ''}`}
                className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-900 leading-snug">
                    {item.name}
                    {item.variantName && (
                      <span className="text-gray-500 font-normal">
                        {' '}· {item.variantName}
                      </span>
                    )}
                  </p>
                  {item.extras.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {item.extras.map((e) => e.name).join(', ')}
                    </p>
                  )}
                  <p className="text-sm text-brand-500 font-bold mt-0.5">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity - 1)
                    }
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-brand-500 font-bold"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity + 1)
                    }
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-brand-500 font-bold"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId, item.variantId)}
                    className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-bold text-lg text-brand-900">
                {formatPrice(total())}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full bg-brand-900 text-white rounded-2xl py-4 font-bold text-base"
            >
              Ir al checkout →
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
