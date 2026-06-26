'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Search } from 'lucide-react';
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
  const [query, setQuery] = useState('');

  // Fetch all businesses; TRIAL filter is applied client-side
  const { data: allBusinesses = [], isLoading } = useSaBusinesses(
    filter !== 'all' && filter !== 'TRIAL' ? (filter as SaBusiness['status']) : undefined,
  );

  // Apply TRIAL + search filters client-side
  const businesses = allBusinesses
    .filter((b) => filter !== 'TRIAL' || b.subscription?.status === 'TRIAL')
    .filter((b) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q);
    });

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

      <div className="flex gap-3 mb-4 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF6B35] focus:border-[#FF6B35]"
          />
        </div>
        <div className="flex gap-2">
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
