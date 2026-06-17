'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrderById, confirmTransfer, updateOrderStatus, type OrderDetail } from '@/api/orders';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW:             { label: 'Nuevo',          color: 'bg-blue-100 text-blue-700' },
  UNDER_REVIEW:    { label: 'En revisión',    color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED:       { label: 'Confirmado',     color: 'bg-indigo-100 text-indigo-700' },
  IN_PREPARATION:  { label: 'En preparación', color: 'bg-orange-100 text-orange-700' },
  READY:           { label: 'Listo',          color: 'bg-green-100 text-green-700' },
  OUT_FOR_DELIVERY:{ label: 'En camino',      color: 'bg-purple-100 text-purple-700' },
  DELIVERED:       { label: 'Entregado',      color: 'bg-gray-100 text-gray-600' },
  CANCELLED:       { label: 'Cancelado',      color: 'bg-red-100 text-red-600' },
  REJECTED:        { label: 'Rechazado',      color: 'bg-red-100 text-red-600' },
};

type ActionConfig = {
  primary: { label: string; status: string; color: string } | null;
  secondary: { label: string; status: string } | null;
  extraPrimary?: { label: string; status: string; color: string };
};

function getActions(order: OrderDetail): ActionConfig {
  switch (order.status) {
    case 'NEW':
      return {
        primary: { label: 'Aceptar pedido', status: 'UNDER_REVIEW', color: 'bg-brand-500 hover:bg-brand-600' },
        secondary: { label: 'Rechazar', status: 'REJECTED' },
      };
    case 'UNDER_REVIEW':
      return {
        primary: { label: 'Confirmar pedido', status: 'CONFIRMED', color: 'bg-indigo-500 hover:bg-indigo-600' },
        secondary: { label: 'Rechazar', status: 'REJECTED' },
      };
    case 'CONFIRMED':
      return {
        primary: { label: 'Iniciar preparación', status: 'IN_PREPARATION', color: 'bg-orange-500 hover:bg-orange-600' },
        secondary: { label: 'Cancelar pedido', status: 'CANCELLED' },
      };
    case 'IN_PREPARATION':
      return {
        primary: { label: 'Marcar como listo', status: 'READY', color: 'bg-green-500 hover:bg-green-600' },
        secondary: { label: 'Cancelar pedido', status: 'CANCELLED' },
      };
    case 'READY':
      if (order.deliveryType === 'DELIVERY') {
        return {
          primary: { label: 'Salió a entrega', status: 'OUT_FOR_DELIVERY', color: 'bg-purple-500 hover:bg-purple-600' },
          secondary: { label: 'Cancelar pedido', status: 'CANCELLED' },
          extraPrimary: { label: 'Entregado (sin repartidor)', status: 'DELIVERED', color: 'bg-gray-500 hover:bg-gray-600' },
        };
      }
      return {
        primary: { label: 'Entregado ✓', status: 'DELIVERED', color: 'bg-gray-600 hover:bg-gray-700' },
        secondary: { label: 'Cancelar pedido', status: 'CANCELLED' },
      };
    case 'OUT_FOR_DELIVERY':
      return {
        primary: { label: 'Marcar como entregado', status: 'DELIVERED', color: 'bg-gray-600 hover:bg-gray-700' },
        secondary: null,
      };
    default:
      return { primary: null, secondary: null };
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 font-medium text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: order, isLoading, isError } = useQuery<OrderDetail>({
    queryKey: ['order', id],
    queryFn: () => getOrderById(id),
    enabled: !!id,
  });

  const { mutate: doConfirmTransfer, isPending: confirmingTransfer } = useMutation({
    mutationFn: () => confirmTransfer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const { mutate: doUpdateStatus, isPending: updatingStatus, variables: pendingVars } = useMutation({
    mutationFn: (status: string) => updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 text-sm mb-4">No se encontró el pedido.</p>
        <button onClick={() => router.back()} className="text-brand-500 text-sm font-semibold">
          ← Regresar
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' };
  const needsTransferConfirm = order.customPaymentMethod?.requiresConfirmation && !order.isPaid &&
    ['CONFIRMED', 'UNDER_REVIEW'].includes(order.status);
  const actions = getActions(order);
  const hasActions = actions.primary || actions.secondary;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            >
              ←
            </button>
            <div>
              <h1 className="font-jakarta text-xl font-bold text-brand-900">
                Pedido #{order.orderNumber}
              </h1>
              <p className="text-xs text-gray-400">
                {new Date(order.createdAt).toLocaleString('es-MX', {
                  dateStyle: 'medium', timeStyle: 'short',
                })}
              </p>
            </div>
            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Pago pendiente banner */}
          {needsTransferConfirm && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-800">Pago pendiente de confirmación</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {order.paymentMethodLabel ?? 'Forma de pago'} — requiere comprobante
                </p>
              </div>
              <button
                onClick={() => doConfirmTransfer()}
                disabled={confirmingTransfer}
                className="bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 whitespace-nowrap"
              >
                {confirmingTransfer ? 'Confirmando…' : 'Confirmar pago'}
              </button>
            </div>
          )}

          {/* Cliente */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Cliente</h2>
            <InfoRow label="Nombre" value={order.customerName} />
            <InfoRow label="Teléfono" value={order.customerPhone} />
            {order.customer?.notes && <InfoRow label="Notas del cliente" value={order.customer.notes} />}
            <InfoRow
              label="Entrega"
              value={order.deliveryType === 'DELIVERY'
                ? `🛵 Delivery${order.deliveryAddress ? ` · ${order.deliveryAddress}` : ''}`
                : '🏠 Recoger en tienda'}
            />
          </div>

          {/* Forma de pago */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Pago</h2>
            <InfoRow
              label="Forma de pago"
              value={order.paymentMethodLabel ?? order.paymentMethod ?? '—'}
            />
            <InfoRow
              label="Estado del pago"
              value={
                order.isPaid ? (
                  <span className="text-green-600 font-semibold">✅ Pagado</span>
                ) : order.customPaymentMethod?.requiresConfirmation ? (
                  <span className="text-amber-600 font-semibold">⏳ Pendiente</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )
              }
            />
          </div>

          {/* Productos */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Productos</h2>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    <span className="font-bold text-brand-500">{item.quantity}×</span>{' '}
                    {item.name}
                  </span>
                  <span className="text-gray-600 font-medium">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
              <span className="text-sm font-bold text-brand-900">Total</span>
              <span className="text-sm font-black text-brand-500">${order.total.toFixed(2)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Notas del pedido</h2>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          )}

          {/* Extra spacing so content doesn't hide behind footer */}
          {hasActions && <div className="h-24" />}
        </div>
      </div>

      {/* Action footer */}
      {hasActions && (
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4 shadow-lg">
          <div className="max-w-2xl mx-auto flex gap-3">
            {actions.secondary && (
              <button
                disabled={updatingStatus}
                onClick={() => doUpdateStatus(actions.secondary!.status)}
                className="flex-1 py-3 rounded-2xl text-sm font-bold border-2 border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {updatingStatus && pendingVars === actions.secondary.status ? 'Un momento…' : actions.secondary.label}
              </button>
            )}

            <div className="flex flex-col gap-2 flex-[2]">
              {actions.extraPrimary && (
                <button
                  disabled={updatingStatus}
                  onClick={() => doUpdateStatus(actions.extraPrimary!.status)}
                  className={`w-full py-2 rounded-2xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${actions.extraPrimary.color}`}
                >
                  {updatingStatus && pendingVars === actions.extraPrimary.status ? 'Un momento…' : actions.extraPrimary.label}
                </button>
              )}

              {actions.primary && (
                <button
                  disabled={updatingStatus}
                  onClick={() => doUpdateStatus(actions.primary!.status)}
                  className={`w-full py-3 rounded-2xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${actions.primary.color}`}
                >
                  {updatingStatus && pendingVars === actions.primary.status ? 'Un momento…' : actions.primary.label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
