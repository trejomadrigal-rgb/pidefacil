'use client';

import { motion } from 'framer-motion';

interface Props {
  mrr: number;
  activeBusinesses: number;
  trialBusinesses: number;
  totalOrders30d: number;
}

const fmtMxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export function SaKpiCards({ mrr, activeBusinesses, trialBusinesses, totalOrders30d }: Props) {
  const cards = [
    { value: fmtMxn(mrr), label: 'MRR', dark: true },
    { value: String(activeBusinesses), label: 'Negocios activos', dark: false },
    { value: String(trialBusinesses), label: 'En trial', dark: false },
    { value: totalOrders30d.toLocaleString(), label: 'Pedidos (30d)', dark: false },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.07, ease: 'easeOut' }}
          className={`rounded-xl p-4 ${card.dark ? 'bg-[#1A1A2E]' : 'bg-white border border-gray-200'}`}
        >
          <p className={`text-2xl font-black ${card.dark ? 'text-white' : 'text-[#FF6B35]'}`}>
            {card.value}
          </p>
          <p className={`text-xs mt-1 ${card.dark ? 'text-white/50' : 'text-gray-400'}`}>
            {card.label}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
