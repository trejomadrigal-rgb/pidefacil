'use client';

import { useLiquidations } from '@/hooks/use-liquidations';
import { DollarSign } from 'lucide-react';

export default function LiquidacionesPage() {
  const { data: liquidations = [], isLoading } = useLiquidations();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Liquidaciones</h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : liquidations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin liquidaciones registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_100px_80px] px-4 py-2 bg-gray-50 border-b border-gray-200">
            {['Fecha', 'Sucursal', 'Repartidor', 'Recibió', 'Monto'].map((h) => (
              <span key={h} className="text-[10px] font-bold text-gray-500 uppercase">{h}</span>
            ))}
          </div>
          {liquidations.map((liq) => (
            <div key={liq.id} className="grid grid-cols-[1fr_100px_100px_100px_80px] px-4 py-3 border-b border-gray-100 last:border-0 items-center">
              <span className="text-sm text-gray-700">{new Date(liq.settledAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="text-sm text-gray-600">{liq.branch.name}</span>
              <span className="text-sm text-gray-600">{liq.deliveryUser.name}</span>
              <span className="text-sm text-gray-600">{liq.receivedBy.name}</span>
              <span className="text-sm font-bold text-gray-900">${Number(liq.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
