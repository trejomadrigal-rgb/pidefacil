'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useShift,
  useCreateTrip,
  useCloseTrip,
  useCloseShift,
  useReadyOrders,
  usePendingTransferOrders,
  useConfirmTransfer,
} from '@/hooks/use-shifts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPrice } from '@/lib/utils';
import { ChevronLeft, Banknote, CreditCard, ArrowUpRight, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReadyOrder } from '@/api/orders';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TripOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: string | number;
  paymentMethod: string | null;
  customerName: string;
  deliveryAddress: string | null;
}

interface Trip {
  id: string;
  status: 'OPEN' | 'CLOSED';
  cashTotal: number | null;
  cardTotal: number | null;
  transferTotal: number | null;
  orders: TripOrder[];
  confirmedBy?: { name: string } | null;
}

// ─── Diálogo de liquidación ───────────────────────────────────────────────────

function LiquidarDialog({
  trip,
  onClose,
  onConfirm,
  isPending,
}: {
  trip: Trip;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const delivered   = trip.orders.filter((o) => o.status === 'DELIVERED');
  const undelivered = trip.orders.filter((o) => o.status !== 'DELIVERED');

  const cashOrders  = delivered.filter((o) => o.paymentMethod === 'CASH');
  const cardOrders  = delivered.filter((o) => o.paymentMethod === 'CARD');
  const transOrders = delivered.filter((o) => o.paymentMethod === 'TRANSFER');

  const expectedCash = cashOrders.reduce((s, o) => s + Number(o.total), 0);
  const cardAmount   = cardOrders.reduce((s, o) => s + Number(o.total), 0);
  const transAmount  = transOrders.reduce((s, o) => s + Number(o.total), 0);

  // Pedidos con efectivo aún no entregados (no cuentan en el monto esperado)
  const pendingCashOrders = undelivered.filter((o) => o.paymentMethod === 'CASH');

  const [cashInput, setCashInput] = useState(
    expectedCash > 0 ? String(expectedCash) : '',
  );

  const actualCash = parseFloat(cashInput.replace(',', '.')) || 0;
  const diff = actualCash - expectedCash;
  const hasCashDiscrepancy = expectedCash > 0 && Math.abs(diff) > 0.01;
  const canConfirm = expectedCash === 0 || cashInput.trim() !== '';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <h2 className="font-black text-gray-900 text-xl mb-1">Liquidar salida</h2>
        <p className="text-sm text-gray-500 mb-5">
          Verifica el efectivo recibido y confirma el cierre.
        </p>

        {/* Campo de efectivo — siempre visible si hay pedidos en efectivo */}
        {expectedCash > 0 ? (
          <div className="bg-brand-500/8 border border-brand-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="w-4 h-4 text-brand-500" />
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                Efectivo a recibir
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-1">
              Esperado: <span className="font-semibold text-gray-700">{formatPrice(expectedCash)}</span>
              {' '}· {cashOrders.length} pedido(s)
            </p>
            <label className="block text-xs font-semibold text-gray-600 mb-1 mt-3">
              Monto real recibido <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 border border-brand-300 rounded-xl text-sm font-bold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                placeholder={String(expectedCash)}
                autoFocus
              />
            </div>
            {hasCashDiscrepancy && (
              <p className={`text-xs mt-2 font-medium ${diff < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                {diff < 0
                  ? `Faltante de ${formatPrice(Math.abs(diff))}`
                  : `Sobrante de ${formatPrice(diff)}`}
              </p>
            )}
            {pendingCashOrders.length > 0 && (
              <p className="text-xs mt-2 text-orange-600">
                +{pendingCashOrders.length} pedido(s) en efectivo sin marcar como entregados — no incluidos.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-gray-400" />
            <p className="text-xs text-gray-500">Sin pedidos en efectivo entregados en esta salida</p>
          </div>
        )}

        {/* Otros medios (solo informativo) */}
        {(cardAmount > 0 || transAmount > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {cardAmount > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500">Tarjeta</p>
                </div>
                <p className="font-bold text-gray-800">{formatPrice(cardAmount)}</p>
              </div>
            )}
            {transAmount > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500">Transferencia</p>
                </div>
                <p className="font-bold text-gray-800">{formatPrice(transAmount)}</p>
              </div>
            )}
          </div>
        )}

        {/* Pedidos sin entregar */}
        {undelivered.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <p className="text-xs font-semibold text-orange-800">
                {undelivered.length} pedido(s) sin marcar como entregados
              </p>
            </div>
            <div className="space-y-1">
              {undelivered.map((o) => (
                <p key={o.id} className="text-xs text-orange-700">
                  #{o.orderNumber} — {o.customerName} · {formatPrice(Number(o.total))}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Lista completa de pedidos */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Pedidos en esta salida ({trip.orders.length})
          </p>
          <div className="space-y-1">
            {trip.orders.map((o) => (
              <div key={o.id} className="flex justify-between items-center text-sm py-1">
                <span className={o.status === 'DELIVERED' ? 'text-gray-600' : 'text-orange-600 font-medium'}>
                  #{o.orderNumber} — {o.customerName}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{o.paymentMethod ?? '—'}</span>
                  <span className="font-semibold">{formatPrice(Number(o.total))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 font-semibold text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || !canConfirm}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Liquidando...' : 'Confirmar liquidación'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TurnoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: shift, isLoading } = useShift(id);
  const { data: readyOrders = [] } = useReadyOrders();
  const { data: confirmedOrders = [] } = usePendingTransferOrders();
  const createTrip = useCreateTrip(id);
  const closeTrip = useCloseTrip();
  const closeShift = useCloseShift();
  const confirmTransfer = useConfirmTransfer();
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [liquidarTrip, setLiquidarTrip] = useState<Trip | null>(null);

  if (isLoading || !shift) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  }

  const pendingTransfers = confirmedOrders.filter(
    (o: ReadyOrder) => o.paymentMethod === 'TRANSFER' && !o.transferConfirmed,
  );

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

  const handleLiquidar = () => {
    if (!liquidarTrip) return;
    closeTrip.mutate(liquidarTrip.id, {
      onSuccess: () => setLiquidarTrip(null),
    });
  };

  return (
    <div className="p-8 max-w-3xl overflow-auto h-full">
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

      {/* Transferencias pendientes de confirmar */}
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

      {/* Nueva salida */}
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

      {/* Salidas existentes */}
      <div className="space-y-4">
        <h2 className="font-bold text-gray-900 text-sm">Salidas</h2>
        {shift.liquidations.length === 0 ? (
          <p className="text-sm text-gray-400">Sin salidas registradas</p>
        ) : (
          shift.liquidations.map((trip) => {
            const deliveredCount = trip.orders.filter((o) => o.status === 'DELIVERED').length;
            const totalCount = trip.orders.length;
            const cashPreview = trip.orders
              .filter((o) => o.paymentMethod === 'CASH' && o.status === 'DELIVERED')
              .reduce((s, o) => s + Number(o.total), 0);

            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={trip.status === 'OPEN' ? 'default' : 'secondary'}>
                      {trip.status === 'OPEN' ? 'En curso' : 'Liquidada'}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {deliveredCount}/{totalCount} entregados
                    </span>
                  </div>
                  {trip.status === 'OPEN' && (
                    <Button
                      size="sm"
                      onClick={() => setLiquidarTrip(trip as Trip)}
                      className="bg-brand-500 hover:bg-brand-600 text-white"
                    >
                      Liquidar salida
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  {trip.orders.map((order) => (
                    <div key={order.id} className="flex justify-between items-center text-sm py-0.5">
                      <span className={order.status === 'DELIVERED' ? 'text-gray-600' : 'text-orange-600 font-medium'}>
                        #{order.orderNumber} — {order.customerName}
                        {order.status !== 'DELIVERED' && ' ⚠'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{order.paymentMethod ?? '—'}</span>
                        <span className="font-medium">{formatPrice(Number(order.total))}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview efectivo (solo cuando está abierta) */}
                {trip.status === 'OPEN' && cashPreview > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                    <Banknote className="w-3.5 h-3.5 text-brand-500" />
                    <p className="text-xs text-gray-500">
                      Efectivo pendiente a recibir:{' '}
                      <span className="font-bold text-brand-600">{formatPrice(cashPreview)}</span>
                    </p>
                  </div>
                )}

                {/* Totales cuando está cerrada */}
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
              </motion.div>
            );
          })
        )}
      </div>

      {/* Diálogo de liquidación */}
      <AnimatePresence>
        {liquidarTrip && (
          <LiquidarDialog
            trip={liquidarTrip}
            onClose={() => setLiquidarTrip(null)}
            onConfirm={handleLiquidar}
            isPending={closeTrip.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
