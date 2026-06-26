'use client';

import { motion } from 'framer-motion';
import type { RevenueByPayment } from '@/api/reports';
import { Banknote, CreditCard, ArrowUpRight } from 'lucide-react';

interface PaymentBreakdownProps {
  data: RevenueByPayment;
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function PaymentBreakdown({ data }: PaymentBreakdownProps) {
  const total = data.cash + data.card + data.transfer;

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-jakarta font-bold text-brand-900 mb-4">Formas de pago</h3>
        <p className="text-gray-400 text-sm">Sin datos para este período.</p>
      </div>
    );
  }

  const rows = [
    { label: 'Efectivo',       amount: data.cash,     pct: (data.cash / total) * 100,     color: 'bg-brand-500',   icon: Banknote,     text: 'text-brand-600' },
    { label: 'Tarjeta',        amount: data.card,     pct: (data.card / total) * 100,     color: 'bg-blue-400',    icon: CreditCard,   text: 'text-blue-600' },
    { label: 'Transferencia',  amount: data.transfer, pct: (data.transfer / total) * 100, color: 'bg-purple-400',  icon: ArrowUpRight, text: 'text-purple-600' },
  ].filter((r) => r.amount > 0);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <h3 className="font-jakarta font-bold text-brand-900 mb-5">Formas de pago</h3>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-5 gap-px">
        {rows.map((r, i) => (
          <motion.div
            key={r.label}
            className={r.color}
            style={{ width: `${r.pct}%`, originX: 0 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <motion.div
              key={r.label}
              className="flex items-center justify-between"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.08 }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${r.color}`} />
                <Icon className={`w-3.5 h-3.5 ${r.text}`} />
                <span className="text-sm text-gray-700">{r.label}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">${fmt(r.amount)}</span>
                <span className="text-xs text-gray-400 ml-2">{r.pct.toFixed(0)}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">Total entregado</span>
        <span className="font-black text-brand-900">${fmt(total)}</span>
      </div>
    </div>
  );
}
