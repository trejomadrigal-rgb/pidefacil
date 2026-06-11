'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getOrderStatus, OrderStatusResponse } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED', 'REJECTED', 'FINISHED'];
const POLL_INTERVAL = 15_000;

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  NEW: { label: 'Pedido recibido', color: 'text-blue-600', bg: 'bg-blue-50', icon: '📩' },
  UNDER_REVIEW: { label: 'En revisión', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '🔍' },
  WAITING_CONFIRMATION: { label: 'Esperando confirmación', color: 'text-orange-500', bg: 'bg-orange-50', icon: '⏳' },
  CONFIRMED: { label: 'Confirmado', color: 'text-green-600', bg: 'bg-green-50', icon: '✅' },
  IN_PREPARATION: { label: 'En preparación', color: 'text-brand-500', bg: 'bg-brand-50', icon: '👩‍🍳' },
  READY: { label: 'Listo para recoger', color: 'text-purple-600', bg: 'bg-purple-50', icon: '🛍️' },
  DELIVERED: { label: 'Entregado', color: 'text-gray-500', bg: 'bg-gray-50', icon: '✔️' },
  CANCELLED: { label: 'Cancelado', color: 'text-red-500', bg: 'bg-red-50', icon: '❌' },
  REJECTED: { label: 'Rechazado', color: 'text-red-500', bg: 'bg-red-50', icon: '❌' },
  FINISHED: { label: 'Finalizado', color: 'text-gray-500', bg: 'bg-gray-50', icon: '✔️' },
};

const STATUS_FLOW = [
  'NEW',
  'CONFIRMED',
  'IN_PREPARATION',
  'READY',
  'DELIVERED',
];

interface OrderStatusProps {
  slug: string;
  orderNumber: string;
}

export function OrderStatus({ slug, orderNumber }: OrderStatusProps) {
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = async () => {
    const data = await getOrderStatus(slug, orderNumber);
    setOrder(data);
    setLoading(false);
    return data;
  };

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const startPolling = () => {
    intervalRef.current = setInterval(async () => {
      const data = await fetchOrder();
      if (data && TERMINAL_STATUSES.includes(data.status)) {
        stopPolling();
      } else {
        setCountdown(POLL_INTERVAL / 1000);
      }
    }, POLL_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
  };

  useEffect(() => {
    fetchOrder().then((data) => {
      if (data && !TERMINAL_STATUSES.includes(data.status)) {
        startPolling();
      }
    });
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, orderNumber]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16 px-4">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="font-bold text-brand-900 mb-2">Pedido no encontrado</h2>
        <p className="text-sm text-gray-500 mb-6">
          Verifica el número de folio.
        </p>
        <Link
          href={`/${slug}`}
          className="inline-block bg-brand-500 text-white rounded-xl px-6 py-3 font-semibold"
        >
          Volver al menú
        </Link>
      </div>
    );
  }

  const currentConfig = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['NEW'];
  const isTerminal = TERMINAL_STATUSES.includes(order.status);
  const isCancelled = ['CANCELLED', 'REJECTED'].includes(order.status);
  const currentIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="px-4 pb-10">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-brand-900">
          Pedido #{order.orderNumber}
        </h1>
      </div>

      {/* Current status card */}
      <div className={`${currentConfig.bg} rounded-2xl p-5 text-center mb-6`}>
        <div className="text-4xl mb-2">{currentConfig.icon}</div>
        <p className={`text-lg font-bold ${currentConfig.color}`}>
          {currentConfig.label}
        </p>
      </div>

      {/* Timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-brand-900 mb-3 text-sm">Seguimiento</h2>
          <div className="space-y-3">
            {STATUS_FLOW.map((status, idx) => {
              const done = idx <= currentIndex;
              const active = idx === currentIndex;
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      done
                        ? active
                          ? 'bg-brand-500 text-white'
                          : 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {done && !active ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      active
                        ? 'font-bold text-brand-900'
                        : done
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {config?.label ?? status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Items summary */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <h2 className="font-bold text-brand-900 mb-2 text-sm">Tu pedido</h2>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span className="text-gray-700">
              {item.name} ×{item.quantity}
            </span>
            <span className="font-semibold">{formatPrice(item.subtotal)}</span>
          </div>
        ))}
        <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-bold text-sm">
          <span>Total</span>
          <span className="text-brand-500">{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* Polling countdown / terminal message */}
      {isCancelled ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-4">
            Lo sentimos, este pedido fue cancelado.
          </p>
          <Link
            href={`/${slug}`}
            className="inline-block bg-brand-500 text-white rounded-xl px-6 py-3 font-semibold"
          >
            Volver al menú
          </Link>
        </div>
      ) : !isTerminal ? (
        <div className="bg-gray-100 rounded-xl py-3 text-center text-sm text-gray-500">
          ↻ Actualiza en {countdown}s
        </div>
      ) : null}
    </div>
  );
}
