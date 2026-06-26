'use client';

import { motion } from 'framer-motion';
import type { PeakHour } from '@/api/reports';

interface PeakHoursChartProps {
  peakHours: PeakHour[];
}

export function PeakHoursChart({ peakHours }: PeakHoursChartProps) {
  const maxCount = Math.max(...peakHours.map((h) => h.orderCount), 1);
  const peakHour = peakHours.reduce((best, h) => (h.orderCount > best.orderCount ? h : best), peakHours[0]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <h3 className="font-jakarta font-bold text-brand-900">Horarios pico</h3>
        {peakHour.orderCount > 0 && (
          <div className="text-right">
            <p className="text-sm font-black text-brand-500">
              {String(peakHour.hour).padStart(2, '0')}:00
            </p>
            <p className="text-[10px] text-gray-400">hora más activa</p>
          </div>
        )}
      </div>

      <div className="flex items-end gap-[2px] h-28">
        {peakHours.map(({ hour, orderCount }) => {
          const heightPct = (orderCount / maxCount) * 100;
          const isPeak = hour === peakHour.hour && orderCount > 0;
          return (
            <div key={hour} className="flex flex-col items-center flex-1">
              <motion.div
                className={`w-full rounded-t cursor-default ${isPeak ? 'bg-brand-500' : 'bg-brand-500/40 hover:bg-brand-500/70'} transition-colors`}
                title={`${String(hour).padStart(2, '0')}:00 — ${orderCount} pedido${orderCount !== 1 ? 's' : ''}`}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.35, delay: hour * 0.012, ease: 'easeOut' }}
                style={{ height: `${Math.max(heightPct, 2)}%`, originY: '100%' }}
              />
              {hour % 6 === 0 && (
                <span className="text-[9px] text-gray-400 mt-1">{hour}h</span>
              )}
            </div>
          );
        })}
      </div>

      {peakHours.every((h) => h.orderCount === 0) && (
        <p className="text-gray-400 text-sm mt-3 text-center">Sin pedidos en este período.</p>
      )}
    </div>
  );
}
