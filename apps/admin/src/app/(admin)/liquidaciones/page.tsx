'use client';

import { useLiquidations } from '@/hooks/use-liquidations';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export default function LiquidacionesPage() {
  const { data: liquidations = [], isLoading } = useLiquidations();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Historial de liquidaciones</h1>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : liquidations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin liquidaciones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liquidations.map((liq) => (
            <div key={liq.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">{liq.shift.deliveryUser.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(liq.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    {liq.confirmedBy && ` · Liquidó: ${liq.confirmedBy.name}`}
                  </p>
                </div>
                <Badge variant={liq.status === 'OPEN' ? 'default' : 'secondary'}>
                  {liq.status === 'OPEN' ? 'En curso' : 'Cerrada'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-gray-500 text-xs">Efectivo</p><p className="font-bold">{formatPrice(Number(liq.cashTotal))}</p></div>
                <div><p className="text-gray-500 text-xs">Tarjeta</p><p className="font-bold">{formatPrice(Number(liq.cardTotal))}</p></div>
                <div><p className="text-gray-500 text-xs">Transferencia</p><p className="font-bold">{formatPrice(Number(liq.transferTotal))}</p></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{liq.orders.length} pedidos</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
