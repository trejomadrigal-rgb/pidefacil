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
          className="w-full bg-brand-500 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg pointer-events-auto active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <span className="font-bold">
              {itemCount()} {itemCount() === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <span className="font-bold">{formatPrice(total())} →</span>
        </button>
      </div>
      <CartDrawer slug={slug} open={isDrawerOpen} onClose={closeDrawer} />
    </>
  );
}
