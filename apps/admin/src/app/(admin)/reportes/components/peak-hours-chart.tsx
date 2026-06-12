import type { PeakHour } from '@/api/reports';

interface PeakHoursChartProps {
  peakHours: PeakHour[];
}

export function PeakHoursChart({ peakHours }: PeakHoursChartProps) {
  const maxCount = Math.max(...peakHours.map((h) => h.orderCount), 1);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <h3 className="font-jakarta font-bold text-brand-900 mb-5">Horarios pico</h3>
      <div className="flex items-end gap-1 h-28">
        {peakHours.map(({ hour, orderCount }) => {
          const heightPct = (orderCount / maxCount) * 100;
          return (
            <div key={hour} className="flex flex-col items-center flex-1">
              <div
                className="w-full bg-brand-500/70 hover:bg-brand-500 rounded-t transition-colors cursor-default"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                title={`${String(hour).padStart(2, '0')}:00 — ${orderCount} pedido${orderCount !== 1 ? 's' : ''}`}
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
