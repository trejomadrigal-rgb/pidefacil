import type { TopProduct } from '@/api/reports';

interface TopProductsChartProps {
  products: TopProduct[];
}

export function TopProductsChart({ products }: TopProductsChartProps) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-jakarta font-bold text-brand-900 mb-4">Productos más vendidos</h3>
        <p className="text-gray-400 text-sm">Sin datos para este período.</p>
      </div>
    );
  }

  const maxQty = products[0].totalQuantity;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <h3 className="font-jakarta font-bold text-brand-900 mb-5">Productos más vendidos</h3>
      <div className="space-y-3">
        {products.map((p, i) => {
          const pct = maxQty > 0 ? (p.totalQuantity / maxQty) * 100 : 0;
          return (
            <div key={p.productId} className="flex items-center gap-3">
              <span className="text-brand-500 font-black text-sm w-5">{i + 1}</span>
              <span className="text-sm text-gray-700 w-36 truncate" title={p.productName}>
                {p.productName}
              </span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-800 w-8 text-right">
                {p.totalQuantity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
