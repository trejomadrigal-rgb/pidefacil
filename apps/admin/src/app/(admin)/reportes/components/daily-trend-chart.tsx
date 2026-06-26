'use client';

import { motion } from 'framer-motion';
import type { DailyTrend } from '@/api/reports';

interface DailyTrendChartProps {
  trend: DailyTrend[];
}

function fmtDate(dateStr: string) {
  const [, , dd] = dateStr.split('-');
  return dd;
}

function fmtMonth(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}

export function DailyTrendChart({ trend }: DailyTrendChartProps) {
  if (trend.length <= 1) return null;

  const maxRevenue = Math.max(...trend.map((d) => d.revenue), 1);
  const total = trend.reduce((s, d) => s + d.revenue, 0);
  const bestDay = trend.reduce((best, d) => (d.revenue > best.revenue ? d : best), trend[0]);

  // Label every Nth day to avoid crowding
  const labelEvery = trend.length <= 7 ? 1 : trend.length <= 14 ? 2 : 5;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm col-span-1 md:col-span-2">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-jakarta font-bold text-brand-900">Tendencia de ventas</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {trend.length} días · mejor día:{' '}
            <span className="font-semibold text-brand-600">{fmtMonth(bestDay.date)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-brand-500">
            ${total.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-gray-400">total del período</p>
        </div>
      </div>

      <div className="flex items-end gap-[3px] h-32">
        {trend.map((day, i) => {
          const heightPct = (day.revenue / maxRevenue) * 100;
          const showLabel = i % labelEvery === 0;
          const isBest = day.date === bestDay.date && day.revenue > 0;

          return (
            <div key={day.date} className="flex flex-col items-center flex-1 min-w-0">
              <motion.div
                className={`w-full rounded-t cursor-default group relative ${isBest ? 'bg-brand-500' : 'bg-brand-500/40 hover:bg-brand-500/70'} transition-colors`}
                style={{ height: `${Math.max(heightPct, day.revenue > 0 ? 3 : 1)}%`, originY: '100%' }}
                title={`${fmtMonth(day.date)}: $${day.revenue.toLocaleString('es-MX')} · ${day.orders} pedido${day.orders !== 1 ? 's' : ''}`}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.4, delay: i * 0.015, ease: 'easeOut' }}
              />
              {showLabel && (
                <span className="text-[8px] text-gray-400 mt-1 truncate w-full text-center">
                  {trend.length <= 7 ? fmtMonth(day.date) : fmtDate(day.date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
