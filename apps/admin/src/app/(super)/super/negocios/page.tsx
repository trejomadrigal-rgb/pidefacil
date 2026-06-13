'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSaBusinesses } from '@/hooks/use-super-admin';
import type { SaBusiness } from '@/api/super-admin';
import { SaBizTable } from '../dashboard/components/sa-biz-table';

type Filter = 'all' | SaBusiness['status'] | 'TRIAL';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Todos',
  ACTIVE: 'Activos',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspendidos',
  INACTIVE: 'Inactivos',
};

const FILTER_OPTIONS: Filter[] = ['all', 'ACTIVE', 'TRIAL', 'SUSPENDED'];

export default function SuperNegociosPage() {
  const [filter, setFilter] = useState<Filter>('all');
  // 'TRIAL' is a subscription status, not a business status; pass it as a cast so the
  // API can handle it while keeping the filter UX intact.
  const apiStatus =
    filter === 'all' ? undefined : (filter as SaBusiness['status']);
  const { data: businesses = [], isLoading } = useSaBusinesses(apiStatus);

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Negocios</h1>
        <Link
          href="/super/negocios/nuevo"
          className="bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e55a2b] transition-colors"
        >
          + Nuevo negocio
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1 rounded-full font-medium transition-colors ${
              filter === f
                ? 'bg-[#1A1A2E] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          Cargando...
        </div>
      ) : (
        <SaBizTable businesses={businesses} />
      )}
    </div>
  );
}
