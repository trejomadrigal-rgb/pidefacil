'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useMenuDesignerStore } from '@/store/menu-designer.store';
import { useMenus } from '@/hooks/use-menus';
import { useCategories, type Category } from '@/hooks/use-categories';
import { useProducts } from '@/hooks/use-products';
import { formatPrice } from '@/lib/utils';

export function QRPreviewSheet() {
  const { previewOpen, selectedMenuId, togglePreview } = useMenuDesignerStore();
  const { data: menus = [] } = useMenus();
  const menu = menus.find((m) => m.id === selectedMenuId);

  const { data: categories = [] } = useCategories(selectedMenuId ?? undefined);
  const activeCategories = categories.filter((c) => c.status === 'ACTIVE');

  return (
    <Sheet open={previewOpen} onOpenChange={(open) => { if (!open) togglePreview(); }}>
      <SheetContent side="right" className="w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-gray-200">
          <SheetTitle className="font-jakarta font-bold text-brand-900 text-sm">
            Preview QR — {menu?.name ?? 'Sin menú seleccionado'}
          </SheetTitle>
          <p className="text-xs text-gray-400">Simulación de la vista pública del cliente</p>
        </SheetHeader>

        {/* Mobile simulator */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-4">
          {!menu ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">
                Selecciona un menú para ver el preview
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg max-w-[280px] mx-auto">
              {/* Simulated phone header */}
              <div className="bg-brand-900 px-4 py-3">
                <h3 className="font-jakarta font-bold text-white text-sm">{menu.name}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Menú público</p>
              </div>

              {/* Categories + products */}
              <div className="divide-y divide-gray-100">
                {activeCategories.map((cat) => (
                  <CategoryPreview key={cat.id} category={cat} />
                ))}
                {activeCategories.length === 0 && (
                  <p className="text-xs text-gray-400 p-4 text-center">Sin categorías</p>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Inner component to load products per category
function CategoryPreview({ category }: { category: Category }) {
  const { data: products = [] } = useProducts(category.id);
  const activeProducts = products.filter((p) => p.isAvailable);

  if (activeProducts.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
        {category.name}
      </h4>
      <div className="space-y-2">
        {activeProducts.map((product) => (
          <div key={product.id} className="flex items-center gap-3">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-brand-900 truncate">{product.name}</p>
              <p className="text-[10px] text-gray-500">{formatPrice(product.price)}</p>
            </div>
            <span className="text-xs font-bold text-brand-500 flex-shrink-0">
              {formatPrice(product.price)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
