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
