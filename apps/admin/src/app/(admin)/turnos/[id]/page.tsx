'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useShift,
  useCreateTrip,
  useCloseTrip,
  useCloseShift,
  useReadyOrders,
  useConfirmTransfer,
} from '@/hooks/use-shifts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPrice } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReadyOrder } from '@/api/orders';

export default function TurnoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: shift, isLoading } = useShift(id);
  const { data: readyOrders = [] } = useReadyOrders();
  const createTrip = useCreateTrip(id);
  const closeTrip = useCloseTrip();
  const closeShift = useCloseShift();
  const confirmTransfer = useConfirmTransfer();
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  if (isLoading || !shift) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  }

  // Orders with pending transfer (TRANSFER payment + not yet confirmed)
  const pendingTransfers = readyOrders.filter(
    (o: ReadyOrder) =>
      o.paymentMethod === 'TRANSFER' &&
      !o.transferConfirmed &&
      (o.status === 'CONFIRMED' || o.status === 'NEW' || o.status === 'UNDER_REVIEW'),
  );

  // READY orders not already in a trip and not blocked by unconfirmed transfer
  const assignableOrders = readyOrders.filter(
    (o: ReadyOrder) =>
      o.status === 'READY' &&
      !o.liquidationId &&
      !(o.paymentMethod === 'TRANSFER' && !o.transferConfirmed),
  );

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((x) => x !== orderId) : [...prev, orderId],
    );
  };

  const handleCreateTrip = async () => {
    if (selectedOrderIds.length === 0) return;
    try {
      await createTrip.mutateAsync(selectedOrderIds);
      setSelectedOrderIds([]);
    } catch {
      // Error visible via createTrip.isError
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link
        href="/turnos"
        className="flex items-center text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        <ChevronLeft className="w-4 h-4 mr-1" /> Turnos
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{shift.deliveryUser.name}</h1>
          <p className="text-sm text-gray-500">
            Abierto por {shift.openedBy.name} ·{' '}
            {new Date(shift.openedAt).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {shift.status === 'OPEN' && (
          <Button
            variant="outline"
            onClick={() => closeShift.mutate(id)}
            disabled={closeShift.isPending}
          >
            {closeShift.isPending ? 'Cerrando...' : 'Cerrar turno'}
          </Button>
        )}
      </div>

      {/* Pending transfers */}
      {pendingTransfers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <h2 className="font-bold text-orange-800 mb-3 text-sm">Esperando transferencia</h2>
          <div className="space-y-2">
            {pendingTransfers.map((order: ReadyOrder) => (
              <div key={order.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    #{order.orderNumber} — {order.customerName}
                  </p>
                  <p className="text-xs text-gray-500">{formatPrice(order.total)}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => confirmTransfer.mutate(order.id)}
                  disabled={confirmTransfer.isPending}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Confirmar pago
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create new trip */}
      {shift.status === 'OPEN' && assignableOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h2 className="font-bold text-gray-900 mb-3 text-sm">Nueva salida</h2>
          <div className="space-y-2 mb-4">
            {assignableOrders.map((order: ReadyOrder) => (
              <label
                key={order.id}
                className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50"
              >
                <Checkbox
                  checked={selectedOrderIds.includes(order.id)}
                  onCheckedChange={() => toggleOrder(order.id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    #{order.orderNumber} — {order.customerName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {order.deliveryAddress ?? 'Sin dirección'} · {formatPrice(order.total)} ·{' '}
                    {order.paymentMethod ?? '—'}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {createTrip.isError && (
            <p className="text-sm text-red-600 mb-2">
              No se pudo crear la salida. Intenta de nuevo.
            </p>
          )}
          <Button
            className="bg-brand-500 hover:bg-brand-600 text-white w-full"
            disabled={selectedOrderIds.length === 0 || createTrip.isPending}
            onClick={handleCreateTrip}
          >
            {createTrip.isPending
              ? 'Enviando...'
              : `Crear salida con ${selectedOrderIds.length} pedido(s)`}
          </Button>
        </div>
      )}

      {/* Existing trips */}
      <div className="space-y-4">
        <h2 className="font-bold text-gray-900 text-sm">Salidas</h2>
        {shift.liquidations.length === 0 ? (
          <p className="text-sm text-gray-400">Sin salidas registradas</p>
        ) : (
          shift.liquidations.map((trip) => (
            <div key={trip.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={trip.status === 'OPEN' ? 'default' : 'secondary'}>
                  {trip.status === 'OPEN' ? 'En curso' : 'Liquidada'}
                </Badge>
                {trip.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => closeTrip.mutate(trip.id)}
                    disabled={closeTrip.isPending}
                  >
                    Liquidar salida
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {trip.orders.map((order) => (
                  <div key={order.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      #{order.orderNumber} — {order.status}
                    </span>
                    <span className="font-medium">{formatPrice(Number(order.total))}</span>
                  </div>
                ))}
              </div>
              {trip.status === 'CLOSED' && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Efectivo</p>
                    <p className="font-bold">{formatPrice(Number(trip.cashTotal))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tarjeta</p>
                    <p className="font-bold">{formatPrice(Number(trip.cardTotal))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Transferencia</p>
                    <p className="font-bold">{formatPrice(Number(trip.transferTotal))}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
