'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getMyOrders, MyOrder } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nuevo',
  CONFIRMED: 'Confirmado',
  IN_PREPARATION: 'En preparación',
  READY: '¡Listo!',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rechazado',
};

const STATUS_COLOR: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  IN_PREPARATION: 'bg-orange-100 text-orange-700',
  READY: 'bg-brand-100 text-brand-600',
  DELIVERED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
  REJECTED: 'bg-red-100 text-red-600',
};

interface Props {
  slug: string;
}

export function MyOrdersButton({ slug }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return;
    setLoading(true);
    const result = await getMyOrders(slug, digits);
    setOrders(result);
    setLoading(false);
  };

  const handleClose = () => {
    setOpen(false);
    setPhone('');
    setOrders(null);
  };

  return (
    <>
      {/* Botón visible con fondo sólido */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-white text-[#1A1A2E] px-3 py-2 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-transform flex-shrink-0"
      >
        📋
        <span>Mis pedidos</span>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/60"
              onClick={handleClose}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              className="relative bg-white w-full max-w-md rounded-t-2xl shadow-xl overflow-hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100">
                <h2 className="text-[#1A1A2E] font-extrabold text-base">Mis pedidos</h2>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pt-4 pb-8">
                <p className="text-sm text-gray-500 mb-4 text-center">
                  Ingresa tu número de celular para ver tus pedidos de hoy.
                </p>

                <div className="flex flex-col gap-2 mb-5">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Número de celular (10 dígitos)"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={phone.replace(/\D/g, '').length < 10 || loading}
                    className="w-full bg-brand-500 disabled:opacity-40 text-white rounded-xl px-4 py-3 font-bold text-sm"
                  >
                    {loading ? 'Buscando…' : 'Buscar mis pedidos'}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {orders !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {orders.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-3xl mb-2">🔍</p>
                          <p className="text-sm text-gray-400">
                            No hay pedidos de hoy para este número.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {orders.map((order, i) => (
                            <motion.li
                              key={order.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18, delay: i * 0.06 }}
                            >
                              <Link
                                href={`/${slug}/pedido/${order.orderNumber}`}
                                onClick={handleClose}
                                className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 active:bg-gray-100 transition-colors"
                              >
                                <div>
                                  <p className="font-bold text-[#1A1A2E] text-sm">
                                    Pedido #{order.orderNumber}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {order.itemCount}{' '}
                                    {order.itemCount === 1 ? 'producto' : 'productos'} ·{' '}
                                    ${order.total.toFixed(2)}
                                  </p>
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                                >
                                  {STATUS_LABEL[order.status] ?? order.status}
                                </span>
                              </Link>
                            </motion.li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
