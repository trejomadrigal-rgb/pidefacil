'use client';
import { Product } from '@/lib/api';

export function ProductCard({ product, slug }: { product: Product; slug: string }) {
  return (
    <div className="px-4 py-3">
      <span className="font-semibold">{product.name}</span>
    </div>
  );
}
