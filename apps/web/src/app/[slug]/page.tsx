import { notFound } from 'next/navigation';
import { getBusinessMenu } from '@/lib/api';
import { BusinessHeader } from '@/components/menu/business-header';
import { ProductList } from '@/components/menu/product-list';
import { CategoryPills } from '@/components/menu/category-pills';
import { CartBar } from '@/components/cart/cart-bar';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getBusinessMenu(slug);

  if (!menu) {
    notFound();
  }

  const { business, categories } = menu;

  return (
    <main className="min-h-screen bg-gray-50">
      <BusinessHeader business={business} />
      <CategoryPills categories={categories} />
      <ProductList categories={categories} slug={slug} />
      <CartBar slug={slug} />
    </main>
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
