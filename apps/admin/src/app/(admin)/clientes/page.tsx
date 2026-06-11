'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomers, type TrustLevel } from '@/hooks/use-customers';

const TRUST_CONFIG: Record<TrustLevel, { label: string; className: string }> = {
  NEW:      { label: 'Nuevo',     className: 'bg-gray-100 text-gray-700' },
  FREQUENT: { label: 'Frecuente', className: 'bg-blue-100 text-blue-700' },
  TRUSTED:  { label: 'Confiable', className: 'bg-green-100 text-green-700' },
  RISK:     { label: 'Riesgo',    className: 'bg-amber-100 text-amber-700' },
  BLOCKED:  { label: 'Bloqueado', className: 'bg-red-100 text-red-700' },
};

export default function ClientesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [trustLevel, setTrustLevel] = useState<TrustLevel | undefined>();
  const { data, isLoading } = useCustomers({ search: search || undefined, trustLevel });
  const customers = data?.data ?? [];

  return (
    <div className="p-8 h-full overflow-auto">
      <h1 className="font-jakarta text-2xl font-bold text-brand-900 mb-6">Clientes</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-brand-500"
        />
        <select
          value={trustLevel ?? ''}
          onChange={(e) => setTrustLevel((e.target.value as TrustLevel) || undefined)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="">Todos los niveles</option>
          {(Object.keys(TRUST_CONFIG) as TrustLevel[]).map((level) => (
            <option key={level} value={level}>{TRUST_CONFIG[level].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : customers.length === 0 ? (
        <p className="text-gray-400 text-sm">No hay clientes registrados.</p>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Teléfono</th>
                <th className="px-4 py-3 text-left">Nivel</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-right">Último pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map((c) => {
                const trust = TRUST_CONFIG[c.trustLevel];
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/clientes/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${trust.className}`}>
                        {trust.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {c.lastOrderAt
                        ? new Date(c.lastOrderAt).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
