import { Category } from '@/lib/api';
import { ProductCard } from './product-card';

interface ProductListProps {
  categories: Category[];
  slug: string;
}

export function ProductList({ categories, slug }: ProductListProps) {
  const active = categories.filter((c) => c.products.some((p) => p.isAvailable));

  return (
    <div className="pb-32 px-3 pt-3 space-y-5">
      {active.map((category) => (
        <section key={category.id} id={`cat-${category.id}`}>
          {/* Título de categoría */}
          <div className="flex items-center gap-1.5 mb-3 px-1">
            {category.emoji && (
              <span className="text-[15px]">{category.emoji}</span>
            )}
            <span className="text-[11px] font-extrabold text-[#1A1A2E] uppercase tracking-[0.07em]">
              {category.name}
            </span>
          </div>

          {/* Productos */}
          <div className="flex flex-col gap-2">
            {category.products
              .filter((p) => p.isAvailable)
              .map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  slug={slug}
                  categoryEmoji={category.emoji}
                  animationIndex={i}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
