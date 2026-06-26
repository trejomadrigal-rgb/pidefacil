'use client';

import { motion } from 'framer-motion';
import type { ReportsSummary } from '@/api/reports';

interface KpiCardsProps {
  summary: ReportsSummary;
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function KpiCards({ summary }: KpiCardsProps) {
  const cards = [
    {
      label: 'Ventas totales',
      value: `$${fmt(summary.totalRevenue)}`,
      sub: 'pedidos entregados',
      accent: true,
    },
    {
      label: 'Ticket promedio',
      value: `$${fmt(summary.avgOrderValue)}`,
      sub: 'por pedido entregado',
      accent: false,
    },
    {
      label: 'Total pedidos',
      value: fmt(summary.totalOrders),
      sub: `${fmt(summary.deliveredOrders)} entregados`,
      accent: false,
    },
    {
      label: 'Tasa de entrega',
      value: `${summary.deliveryRate.toFixed(0)}%`,
      sub: `${fmt(summary.cancelledOrders)} cancelados`,
      accent: false,
    },
    {
      label: 'Clientes frecuentes',
      value: fmt(summary.frequentCustomers),
      sub: '2+ pedidos en el período',
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.07, ease: 'easeOut' }}
          className={`bg-white rounded-2xl p-5 border shadow-sm ${card.accent ? 'border-brand-200' : 'border-gray-100'}`}
        >
          <div className={`text-3xl font-black mb-1 ${card.accent ? 'text-brand-500' : 'text-brand-900'}`}>
            {card.value}
          </div>
          <div className="text-xs font-semibold text-gray-600">{card.label}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
