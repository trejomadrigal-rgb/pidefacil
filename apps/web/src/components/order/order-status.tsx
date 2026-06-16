'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrderStatus, OrderStatusResponse } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { ChatPanel } from './chat-panel';

const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED', 'REJECTED', 'FINISHED'];
const POLL_INTERVAL = 15_000;

const STATUS_CONFIG: Record<
  string,
  { label: string; labelDelivery?: string; color: string; bg: string; icon: string; iconDelivery?: string }
> = {
  NEW: { label: 'Pedido recibido', color: 'text-blue-600', bg: 'bg-blue-50', icon: '📩' },
  UNDER_REVIEW: { label: 'En revisión', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '🔍' },
  WAITING_CONFIRMATION: { label: 'Esperando confirmación', color: 'text-orange-500', bg: 'bg-orange-50', icon: '⏳' },
  CONFIRMED: { label: 'Confirmado', color: 'text-green-600', bg: 'bg-green-50', icon: '✅' },
  IN_PREPARATION: { label: 'En preparación', color: 'text-brand-500', bg: 'bg-brand-50', icon: '👩‍🍳' },
  READY: {
    label: 'Listo para recoger',
    labelDelivery: 'Listo para enviar',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    icon: '🛍️',
    iconDelivery: '📦',
  },
  OUT_FOR_DELIVERY: { label: 'En camino', color: 'text-blue-600', bg: 'bg-blue-50', icon: '🛵' },
  DELIVERED: {
    label: 'Entregado',
    labelDelivery: 'Entregado a domicilio',
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    icon: '✔️',
    iconDelivery: '🏠',
  },
  CANCELLED: { label: 'Cancelado', color: 'text-red-500', bg: 'bg-red-50', icon: '❌' },
  REJECTED: { label: 'Rechazado', color: 'text-red-500', bg: 'bg-red-50', icon: '❌' },
  FINISHED: { label: 'Finalizado', color: 'text-gray-500', bg: 'bg-gray-50', icon: '✔️' },
};

const PICKUP_FLOW = ['NEW', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'DELIVERED'];
const DELIVERY_FLOW = ['NEW', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function getLabel(status: string, isDelivery: boolean) {
  const config = STATUS_CONFIG[status];
  if (!config) return status;
  return isDelivery && config.labelDelivery ? config.labelDelivery : config.label;
}

function getIcon(status: string, isDelivery: boolean) {
  const config = STATUS_CONFIG[status];
  if (!config) return '•';
  return isDelivery && config.iconDelivery ? config.iconDelivery : config.icon;
}

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
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center max-w-sm mx-auto">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="font-bold text-brand-900 mb-2">Pedido no encontrado</h2>
        <p className="text-sm text-gray-500 mb-8">
          Verifica el número de folio.
        </p>
        <Link
          href={`/${slug}`}
          className="inline-flex items-center justify-center w-full bg-brand-500 text-white rounded-xl py-3 font-bold text-sm"
        >
          ← Volver al menú
        </Link>
      </div>
    );
  }

  const isDelivery = order.deliveryType === 'DELIVERY';
  const statusFlow = isDelivery ? DELIVERY_FLOW : PICKUP_FLOW;
  const currentConfig = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['NEW'];
  const isTerminal = TERMINAL_STATUSES.includes(order.status);
  const isCancelled = ['CANCELLED', 'REJECTED'].includes(order.status);
  const currentIndex = statusFlow.indexOf(order.status);

  return (
    <div className="px-4 pt-6 pb-12 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-brand-900">
          Pedido #{order.orderNumber}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {isDelivery ? '🛵 Entrega a domicilio' : '🛍️ Recoger en tienda'}
        </p>
      </div>

      {/* Current status card — re-anima cada vez que cambia el estado */}
      <AnimatePresence mode="wait">
        <motion.div
          key={order.status}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ type: 'spring', damping: 18, stiffness: 320 }}
          className={`${currentConfig.bg} rounded-2xl p-5 text-center mb-6`}
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 280, delay: 0.06 }}
            className="text-4xl mb-2"
          >
            {getIcon(order.status, isDelivery)}
          </motion.div>
          <p className={`text-lg font-bold ${currentConfig.color}`}>
            {getLabel(order.status, isDelivery)}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-brand-900 mb-3 text-sm">Seguimiento</h2>
          <div className="space-y-3">
            {statusFlow.map((status, idx) => {
              const done = idx <= currentIndex;
              const active = idx === currentIndex;
              return (
                <motion.div
                  key={status}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: idx * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors duration-300 ${
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
                    className={`text-sm transition-colors duration-300 ${
                      active
                        ? 'font-bold text-brand-900'
                        : done
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {getLabel(status, isDelivery)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat with delivery driver */}
      {order.assignedToId && !isTerminal && !isCancelled && (
        <ChatPanel orderId={order.id} />
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

      {/* Transfer pending message */}
      {order.paymentMethod === 'TRANSFER' && !order.transferConfirmed && !isTerminal && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-bold text-orange-800 mb-1">⏳ Pago pendiente</p>
          <p className="text-sm text-orange-700">
            Tu pedido está confirmado. Por favor envía tu pago por transferencia y manda el comprobante por WhatsApp al negocio.
          </p>
        </div>
      )}

      {/* Polling countdown / terminal message */}
      {isCancelled ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-3">😔</p>
          <p className="text-sm text-gray-500 mb-5">
            Lo sentimos, este pedido fue cancelado.
          </p>
          <Link
            href={`/${slug}`}
            className="inline-flex items-center justify-center w-full bg-brand-500 text-white rounded-xl py-3 font-bold text-sm"
          >
            ← Volver al menú
          </Link>
        </div>
      ) : !isTerminal ? (
        <div className="bg-gray-100 rounded-xl py-3 px-4">
          <p className="text-xs text-gray-400 text-center mb-2">↻ Actualizando en {countdown}s</p>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-500 rounded-full"
              animate={{ width: `${(countdown / (POLL_INTERVAL / 1000)) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
