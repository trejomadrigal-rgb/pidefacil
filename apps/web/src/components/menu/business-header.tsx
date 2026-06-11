import Image from 'next/image';
import { BusinessPublic } from '@/lib/api';

interface BusinessHeaderProps {
  business: BusinessPublic;
}

export function BusinessHeader({ business }: BusinessHeaderProps) {
  return (
    <div className="bg-brand-900 text-white px-4 py-5">
      <div className="flex items-center gap-3">
        {business.logoUrl ? (
          <Image
            src={business.logoUrl}
            alt={business.name}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-xl font-bold">
            {business.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold leading-tight">{business.name}</h1>
          {business.address && (
            <p className="text-sm text-gray-300 mt-0.5">{business.address}</p>
          )}
        </div>
      </div>
    </div>
  );
}
