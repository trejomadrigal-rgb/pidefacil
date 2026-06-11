'use client';

import { useEffect, useRef, useState } from 'react';
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

    active.forEach((category) => {
      const section = document.getElementById(`cat-${category.id}`);
      if (!section) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveId(category.id);
          }
        },
        { rootMargin: '-50% 0px -50% 0px' },
      );
      observer.observe(section);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [active]);

  const scrollToCategory = (id: string) => {
    const section = document.getElementById(`cat-${id}`);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveId(id);
  };

  if (active.length === 0) return null;

  return (
    <div
      className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 overflow-x-auto flex gap-2 scrollbar-hide"
    >
      {active.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => scrollToCategory(category.id)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            activeId === category.id
              ? 'bg-brand-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
