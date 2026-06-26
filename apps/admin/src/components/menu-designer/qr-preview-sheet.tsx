'use client';

import { useRef } from 'react';
import QRCode from 'react-qr-code';
import { Download, ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useMenuDesignerStore } from '@/store/menu-designer.store';
import { useMenus } from '@/hooks/use-menus';
import { useCategories, type Category } from '@/hooks/use-categories';
import { useProducts } from '@/hooks/use-products';
import { useAuthStore } from '@/store/auth.store';
import { formatPrice } from '@/lib/utils';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3001';

export function QRPreviewSheet() {
  const { previewOpen, selectedMenuId, togglePreview } = useMenuDesignerStore();
  const { data: menus = [] } = useMenus();
  const menu = menus.find((m) => m.id === selectedMenuId);
  const businessSlug = useAuthStore((s) => s.businessSlug);
  const qrRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useCategories(selectedMenuId ?? undefined);
  const activeCategories = categories.filter((c) => c.status === 'ACTIVE');

  const menuUrl = `${WEB_URL}/${businessSlug ?? ''}`;

  function downloadQR() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${businessSlug ?? 'menu'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Sheet open={previewOpen} onOpenChange={(open) => { if (!open) togglePreview(); }}>
      <SheetContent side="right" className="w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-gray-200">
          <SheetTitle className="font-jakarta font-bold text-brand-900 text-sm">
            QR de tu menú
          </SheetTitle>
          <p className="text-xs text-gray-400">Imprime este código y ponlo en tu negocio</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-4 space-y-4">

          {/* QR Code card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center gap-4">
            <div ref={qrRef} className="p-3 bg-white rounded-xl border border-gray-100">
              <QRCode
                value={menuUrl}
                size={200}
                fgColor="#1A1A2E"
                bgColor="#FFFFFF"
                level="M"
              />
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold text-brand-900 mb-1">Escanea para ver el menú</p>
              <p className="text-[10px] text-gray-400 break-all">{menuUrl}</p>
            </div>

            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs rounded-xl"
                onClick={downloadQR}
              >
                <Download size={13} className="mr-1.5" />
                Descargar SVG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs rounded-xl"
                onClick={() => window.open(menuUrl, '_blank')}
              >
                <ExternalLink size={13} className="mr-1.5" />
                Abrir menú
              </Button>
            </div>
          </div>

          {/* Menu preview */}
          {menu && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-brand-900 px-4 py-3">
                <h3 className="font-jakarta font-bold text-white text-sm">{menu.name}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Vista previa del menú</p>
              </div>
              <div className="divide-y divide-gray-100">
                {activeCategories.map((cat) => (
                  <CategoryPreview key={cat.id} category={cat} />
                ))}
                {activeCategories.length === 0 && (
                  <p className="text-xs text-gray-400 p-4 text-center">Sin categorías activas</p>
                )}
              </div>
            </div>
          )}

          {!menu && (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400">Selecciona un menú en el panel</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-brand-900 truncate">{product.name}</p>
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
