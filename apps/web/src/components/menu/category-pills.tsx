'use client';

import { useEffect, useState } from 'react';
import { Category } from '@/lib/api';

interface CategoryPillsProps {
  categories: Category[];
}

export function CategoryPills({ categories }: CategoryPillsProps) {
  const [activeId, setActiveId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const active = categories.filter((c) => c.products.some((p) => p.isAvailable));

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const activeCategories = categories.filter((c) =>
      c.products.some((p) => p.isAvailable),
    );

    activeCategories.forEach((category) => {
      const section = document.getElementById(`cat-${category.id}`);
      if (!section) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(category.id);
        },
        { rootMargin: '-50% 0px -50% 0px' },
      );
      observer.observe(section);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [categories]);

  const scrollToCategory = (id: string) => {
    const section = document.getElementById(`cat-${id}`);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  if (active.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-3 py-[10px] overflow-x-auto flex gap-2 scrollbar-hide">
      {active.map((category) => {
        const isActive = activeId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => scrollToCategory(category.id)}
            className="flex-shrink-0 px-4 py-[5px] rounded-full text-[11px] font-bold transition-colors"
            style={
              isActive
                ? { background: 'var(--brand)', color: '#fff' }
                : { background: '#F4F4F6', color: '#666' }
            }
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
