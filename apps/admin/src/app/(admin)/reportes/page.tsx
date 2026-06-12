'use client';

import { useMemo, useState } from 'react';
import { useReportsDashboard } from '@/hooks/use-reports';
import { DateFilter } from './components/date-filter';
import { KpiCards } from './components/kpi-cards';
import { TopProductsChart } from './components/top-products-chart';
import { PeakHoursChart } from './components/peak-hours-chart';

type Preset = 'today' | '7d' | '30d' | 'custom';

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function getDateRange(preset: Preset, customStart: string, customEnd: string) {
  const now = new Date();
  if (preset === 'today') {
    const d = toDateStr(now);
    return { startDate: d, endDate: d };
  }
  if (preset === '7d') {
    const end = toDateStr(now);
    const start = toDateStr(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return { startDate: start, endDate: end };
  }
  if (preset === '30d') {
    const end = toDateStr(now);
    const start = toDateStr(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    return { startDate: start, endDate: end };
  }
  return { startDate: customStart, endDate: customEnd };
}

const EMPTY_SUMMARY = {
  totalRevenue: 0, totalOrders: 0, deliveredOrders: 0,
  cancelledOrders: 0, confirmedOrders: 0, frequentCustomers: 0,
};

export default function ReportesPage() {
  const [preset, setPreset] = useState<Preset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { startDate, endDate } = useMemo(
    () => getDateRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );

  const { data, isLoading, isError } = useReportsDashboard(startDate, endDate);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const topProducts = data?.topProducts ?? [];
  const peakHours = data?.peakHours ?? Array.from({ length: 24 }, (_, hour) => ({ hour, orderCount: 0 }));

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="font-jakarta text-2xl font-bold text-brand-900">Reportes</h1>
        <DateFilter
          preset={preset}
          customStart={customStart}
          customEnd={customEnd}
          onPresetChange={setPreset}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600 text-sm">
          Error al cargar los reportes. Intenta de nuevo.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-gray-100 rounded-2xl" />
            <div className="h-48 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <KpiCards summary={summary} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TopProductsChart products={topProducts} />
            <PeakHoursChart peakHours={peakHours} />
          </div>
          {summary.frequentCustomers > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm inline-flex items-center gap-2">
              <span className="text-2xl font-black text-brand-500">{summary.frequentCustomers}</span>
              <span className="text-sm text-gray-500">
                cliente{summary.frequentCustomers !== 1 ? 's' : ''} frecuente{summary.frequentCustomers !== 1 ? 's' : ''} en este período
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
