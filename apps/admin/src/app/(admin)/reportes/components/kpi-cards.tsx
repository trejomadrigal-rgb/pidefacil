import type { ReportsSummary } from '@/api/reports';

interface KpiCardsProps {
  summary: ReportsSummary;
}

export function KpiCards({ summary }: KpiCardsProps) {
  const cards = [
    {
      label: 'Ventas totales',
      value: `$${summary.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`,
      accent: true,
    },
    { label: 'Total pedidos', value: String(summary.totalOrders), accent: false },
    { label: 'Entregados', value: String(summary.deliveredOrders), accent: false },
    { label: 'Cancelados', value: String(summary.cancelledOrders), accent: false },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div
            className={`text-3xl font-black mb-1 ${card.accent ? 'text-brand-500' : 'text-brand-900'}`}
          >
            {card.value}
          </div>
          <div className="text-xs text-gray-400 font-medium">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
