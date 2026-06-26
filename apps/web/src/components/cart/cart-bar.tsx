'use client';

import { ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cart.store';
import { formatPrice } from '@/lib/utils';
import { CartDrawer } from './cart-drawer';

interface CartBarProps {
  slug: string;
}

export function CartBar({ slug }: CartBarProps) {
  const { items, total, itemCount, openDrawer, isDrawerOpen, closeDrawer } =
    useCartStore();

  return (
    <AnimatePresence>
      {items.length > 0 && (
        <>
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 350 }}
            className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pointer-events-none"
          >
            <button
              type="button"
              onClick={openDrawer}
              className="w-full bg-[#1A1A2E] rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg pointer-events-auto active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2 text-white">
                <ShoppingCart size={20} />
                <motion.span
                  key={itemCount()}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 300 }}
                  className="font-bold"
                >
                  {itemCount()} {itemCount() === 1 ? 'producto' : 'productos'}
                </motion.span>
              </div>
              <span className="font-bold" style={{ color: 'var(--brand)' }}>
                {formatPrice(total())} →
              </span>
            </button>
          </motion.div>
          <CartDrawer slug={slug} open={isDrawerOpen} onClose={closeDrawer} />
        </>
      )}
    </AnimatePresence>
  );
}
