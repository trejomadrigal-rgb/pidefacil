'use client';

import { useState } from 'react';
import Link from 'next/link';
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
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full font-medium transition-colors"
      >
        📋 Mis pedidos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

          <div className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-brand-900 px-5 py-4 flex items-center justify-between">
              <h2 className="text-white font-bold text-base">Revisa tu pedido</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="p-5">
              <p className="text-sm text-gray-500 mb-3">
                Ingresa tu número de celular para ver los pedidos de hoy.
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10 dígitos"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={phone.replace(/\D/g, '').length < 10 || loading}
                  className="bg-brand-500 disabled:opacity-40 text-white rounded-xl px-4 py-3 font-semibold text-sm"
                >
                  {loading ? '...' : 'Buscar'}
                </button>
              </div>

              {orders !== null && (
                orders.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-4">
                    No encontramos pedidos de hoy para este número.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {orders.map((order) => (
                      <li key={order.id}>
                        <Link
                          href={`/${slug}/pedido/${order.orderNumber}`}
                          onClick={handleClose}
                          className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 transition-colors"
                        >
                          <div>
                            <p className="font-bold text-gray-800 text-sm">#{order.orderNumber}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {order.itemCount} {order.itemCount === 1 ? 'producto' : 'productos'} · ${order.total.toFixed(2)}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
