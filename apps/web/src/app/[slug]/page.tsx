import { notFound } from 'next/navigation';
import { getBusinessMenu, getPublicBranches } from '@/lib/api';

export const dynamic = 'force-dynamic';
import { BusinessHeader } from '@/components/menu/business-header';
import { ProductList } from '@/components/menu/product-list';
import { CategoryPills } from '@/components/menu/category-pills';
import { CartBar } from '@/components/cart/cart-bar';
import { MenuClient } from './menu-client';

const THEMES: Record<string, string> = {
  naranja:  '#FF6B35',
  verde:    '#27AE60',
  rojo:     '#E74C3C',
  azul:     '#2980B9',
  morado:   '#8E44AD',
  rosa:     '#E91E8C',
  dorado:   '#F39C12',
  turquesa: '#16A085',
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;
  const [menu, branches] = await Promise.all([
    getBusinessMenu(slug),
    getPublicBranches(slug),
  ]);

  if (!menu) notFound();

  const { business, categories, featuredProduct } = menu;
  const brandColor = THEMES[business.menuColor ?? 'naranja'] ?? THEMES.naranja;
  const selectedBranch = branches.length === 1 ? branches[0] : null;

  return (
    <div style={{ '--brand': brandColor } as React.CSSProperties}>
      <main className="min-h-screen bg-[#F7F8FA]">
        <BusinessHeader
          business={business}
          featuredProduct={featuredProduct}
          selectedBranch={selectedBranch}
          slug={slug}
        />
        <MenuClient branches={branches} />
        <CategoryPills categories={categories} />
        <ProductList categories={categories} slug={slug} />
        <CartBar slug={slug} />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const menu = await getBusinessMenu(slug);
  if (!menu) return {};
  return {
    title: `${menu.business.name} — PideFacil`,
    description: menu.business.description ?? `Pide en ${menu.business.name}`,
  };
}
