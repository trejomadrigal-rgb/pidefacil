import Image from 'next/image';
import { BusinessPublic, Product, PublicBranch } from '@/lib/api';
import { MyOrdersButton } from './my-orders-button';
import { FeaturedProductButton } from './featured-product-button';

interface BusinessHeaderProps {
  business: BusinessPublic;
  featuredProduct: Product | null;
  selectedBranch: PublicBranch | null;
  slug: string;
}

export function BusinessHeader({ business, featuredProduct, selectedBranch, slug }: BusinessHeaderProps) {
  const mapsUrl = selectedBranch
    ? `https://maps.google.com/?q=${selectedBranch.latitude},${selectedBranch.longitude}`
    : business.address
      ? `https://maps.google.com/?q=${encodeURIComponent(business.address)}`
      : null;

  const locationLabel = selectedBranch?.address ?? business.address ?? null;

  return (
    <div className="bg-[#1A1A2E] px-4 pt-5 pb-4 space-y-3">
      {/* Negocio: logo + nombre + dirección */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {business.logoUrl ? (
            <Image
              src={business.logoUrl}
              alt={business.name}
              width={44}
              height={44}
              className="rounded-[10px] object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center text-lg font-black text-white flex-shrink-0"
              style={{ background: 'var(--brand)' }}
            >
              {business.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[15px] font-extrabold text-white leading-tight truncate">
              {business.name}
            </h1>
            {locationLabel && (
              mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] mt-0.5 flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--brand)' }}
                >
                  <span>📍</span>
                  <span className="truncate">{locationLabel}</span>
                  <span className="text-[9px] opacity-70 flex-shrink-0">↗</span>
                </a>
              ) : (
                <p className="text-[11px] text-[#8899BB] mt-0.5 truncate">📍 {locationLabel}</p>
              )
            )}
          </div>
        </div>
        <MyOrdersButton slug={business.slug} />
      </div>

      {/* Producto destacado */}
      {featuredProduct && (
        <FeaturedProductButton product={featuredProduct} slug={slug} />
      )}
    </div>
  );
}
