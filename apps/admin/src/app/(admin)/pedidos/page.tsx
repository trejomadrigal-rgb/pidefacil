'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrders, type ReadyOrder } from '@/api/orders';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const TABS = [
  { label: 'Activos',         status: undefined },
  { label: 'Nuevos',          status: 'NEW' },
  { label: 'En preparación',  status: 'IN_PREPARATION' },
  { label: 'Listos',          status: 'READY' },
  { label: 'En camino',       status: 'OUT_FOR_DELIVERY' },
];

function OrderCard({ order }: { order: ReadyOrder }) {
  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' };
  const time = new Date(order.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <Link
      href={`/pedidos/${order.id}`}
      className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
    >
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
          {order.deliveryType === 'DELIVERY' ? '🛵 Delivery' : '🏠 Recoger'} · {order.itemCount} producto{order.itemCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-black text-brand-500 text-base">${order.total.toFixed(2)}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{time}</p>
      </div>
    </Link>
  );
}

export default function PedidosPage() {
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  const { data: orders = [], isLoading } = useQuery<ReadyOrder[]>({
    queryKey: ['orders', activeTab],
    queryFn: () => getOrders(activeTab),
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6 md:p-8 h-full overflow-auto">
      <h1 className="font-jakarta text-2xl font-extrabold text-brand-900 mb-6">Pedidos de hoy</h1>

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
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
