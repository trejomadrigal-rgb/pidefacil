'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrders, updateOrderStatus, type ReadyOrder } from '@/api/orders';
import { Package, ChevronRight, Plus } from 'lucide-react';
import { CreateOrderSheet } from '@/components/orders/create-order-sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW:              { label: 'Nuevo',          color: 'bg-blue-100 text-blue-700' },
  UNDER_REVIEW:     { label: 'En revisión',    color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED:        { label: 'Confirmado',     color: 'bg-indigo-100 text-indigo-700' },
  IN_PREPARATION:   { label: 'En preparación', color: 'bg-orange-100 text-orange-700' },
  READY:            { label: 'Listo',          color: 'bg-green-100 text-green-700' },
  OUT_FOR_DELIVERY: { label: 'En camino',      color: 'bg-purple-100 text-purple-700' },
  DELIVERED:        { label: 'Entregado',      color: 'bg-gray-100 text-gray-500' },
  CANCELLED:        { label: 'Cancelado',      color: 'bg-red-100 text-red-600' },
};

// Primary next action for each status
function getQuickAction(order: ReadyOrder): { label: string; nextStatus: string; color: string } | null {
  switch (order.status) {
    case 'NEW':
      return { label: 'Aceptar', nextStatus: 'UNDER_REVIEW', color: 'bg-brand-500 text-white' };
    case 'UNDER_REVIEW':
      return { label: 'Confirmar', nextStatus: 'CONFIRMED', color: 'bg-indigo-500 text-white' };
    case 'CONFIRMED':
      return { label: 'En preparación', nextStatus: 'IN_PREPARATION', color: 'bg-orange-500 text-white' };
    case 'IN_PREPARATION':
      return { label: 'Listo ✓', nextStatus: 'READY', color: 'bg-green-500 text-white' };
    case 'READY':
      if (order.deliveryType === 'DELIVERY') {
        return { label: 'Salió', nextStatus: 'OUT_FOR_DELIVERY', color: 'bg-purple-500 text-white' };
      }
      return { label: 'Entregado ✓', nextStatus: 'DELIVERED', color: 'bg-gray-600 text-white' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Entregado ✓', nextStatus: 'DELIVERED', color: 'bg-gray-600 text-white' };
    default:
      return null;
  }
}

const TABS = [
  { label: 'Activos',        status: undefined },
  { label: 'Nuevos',         status: 'NEW' },
  { label: 'En preparación', status: 'IN_PREPARATION' },
  { label: 'Listos',         status: 'READY' },
  { label: 'En camino',      status: 'OUT_FOR_DELIVERY' },
];

function OrderCard({
  order,
  loadingId,
  onAdvance,
}: {
  order: ReadyOrder;
  loadingId: string | null;
  onAdvance: (id: string, nextStatus: string) => void;
}) {
  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' };
  const time = new Date(order.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const action = getQuickAction(order);
  const isLoading = loadingId === order.id;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
          <Package size={18} className="text-brand-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-brand-900 text-sm">#{order.orderNumber}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', cfg.color)}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-700 truncate mt-0.5">{order.customerName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {order.deliveryType === 'DELIVERY' ? '🛵 Delivery' : '🏠 Recoger'} · {order.itemCount} producto{order.itemCount !== 1 ? 's' : ''} · {time}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-black text-brand-500 text-base">${order.total.toFixed(2)}</p>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
        <Link
          href={`/pedidos/${order.id}`}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Ver detalle <ChevronRight size={12} />
        </Link>

        <div className="ml-auto">
          {action && (
            <button
              disabled={isLoading}
              onClick={() => onAdvance(order.id, action.nextStatus)}
              className={cn(
                'px-4 py-1.5 rounded-xl text-xs font-bold transition-opacity disabled:opacity-50',
                action.color,
              )}
            >
              {isLoading ? '…' : action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PedidosPage() {
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<ReadyOrder[]>({
    queryKey: ['orders', activeTab],
    queryFn: () => getOrders(activeTab),
    refetchInterval: 30_000,
  });

  const { mutate: advance } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOrderStatus(id, status),
    onMutate: ({ id }) => setLoadingId(id),
    onSuccess: () => toast.success('Estatus actualizado'),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'No se pudo actualizar el estatus');
    },
    onSettled: () => {
      setLoadingId(null);
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const handleAdvance = (id: string, nextStatus: string) => advance({ id, status: nextStatus });

  return (
    <div className="p-6 md:p-8 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-jakarta text-2xl font-extrabold text-brand-900">Pedidos de hoy</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-600 transition-colors"
        >
          <Plus size={16} />
          Nuevo pedido
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.status)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold transition-colors',
              activeTab === tab.status
                ? 'bg-brand-500 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-100 shadow-sm',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Package size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin pedidos</p>
          <p className="text-xs mt-1">Los pedidos nuevos aparecerán aquí</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              loadingId={loadingId}
              onAdvance={handleAdvance}
            />
          ))}
        </div>
      )}
      <CreateOrderSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
