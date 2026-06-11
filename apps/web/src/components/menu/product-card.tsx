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
}

export function ProductCard({ product, slug }: ProductCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { addItem } = useCartStore();

  const handleAdd = () => {
    if (product.variants.length > 0 || product.extras.length > 0) {
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
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-900 text-sm leading-snug">
            {product.name}
          </p>
          {product.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {product.description}
            </p>
          )}
          <p className="text-brand-500 font-bold text-sm mt-1">
            {formatPrice(product.price)}
          </p>
        </div>

        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          {product.imageUrl ? (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden">
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-brand-50 flex items-center justify-center text-2xl">
              🍽️
            </div>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="w-8 h-8 bg-brand-500 text-white rounded-full flex items-center justify-center hover:bg-brand-600 active:scale-95 transition-transform"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <ProductSheet
        product={product}
        slug={slug}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
