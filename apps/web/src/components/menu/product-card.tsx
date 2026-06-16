'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart.store';
import { ProductSheet } from './product-sheet';

interface ProductCardProps {
  product: Product;
  slug: string;
  categoryEmoji?: string;
  animationIndex?: number;
}

export function ProductCard({ product, slug, categoryEmoji, animationIndex = 0 }: ProductCardProps) {
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: Math.min(animationIndex * 0.04, 0.4) }}
        className="bg-white rounded-[14px] border border-[#ECEDF0] flex items-center overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
      >
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
      </motion.div>

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
