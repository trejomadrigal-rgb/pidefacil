import { Category } from '@/lib/api';
import { ProductCard } from './product-card';

interface ProductListProps {
  categories: Category[];
  slug: string;
}

export function ProductList({ categories, slug }: ProductListProps) {
  const active = categories.filter((c) => c.products.some((p) => p.isAvailable));

  return (
    <div className="pb-32">
      {active.map((category) => (
        <section
          key={category.id}
          id={`cat-${category.id}`}
          className="mb-6"
        >
          <h2 className="text-base font-bold text-brand-900 px-4 py-3 sticky top-[104px] bg-gray-50 z-10 border-b border-gray-100">
            {category.name}
          </h2>
          <div className="divide-y divide-gray-100">
            {category.products
              .filter((p) => p.isAvailable)
              .map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  slug={slug}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
