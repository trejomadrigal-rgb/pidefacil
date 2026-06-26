import type { SaBizByPlan } from '@/api/super-admin';

const DONUT_COLORS: Record<string, string> = {
  Básico: '#9CA3AF',
  Pro: '#FF6B35',
  Plus: '#7C3AED',
};
const DEFAULT_COLOR = '#E5E7EB';

interface Props { data: SaBizByPlan[]; }

export function SaPlanDonut({ data }: Props) {
  const total = data.reduce((s, p) => s + p.count, 0);

  let cumulative = 0;
  const gradient =
    total === 0
      ? '#E5E7EB 0% 100%'
      : data
          .map((p) => {
            const pct = (p.count / total) * 100;
            const color = DONUT_COLORS[p.planName] ?? DEFAULT_COLOR;
            const seg = `${color} ${cumulative.toFixed(1)}% ${(cumulative + pct).toFixed(1)}%`;
            cumulative += pct;
            return seg;
          })
          .join(', ');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Negocios por plan
      </p>
      <div className="flex items-center gap-4">
        <div
          className="relative w-14 h-14 rounded-full flex-shrink-0"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className="absolute inset-0 m-[10px] bg-white rounded-full" />
        </div>
        <div className="flex flex-col gap-1.5">
          {data.length === 0 ? (
            <p className="text-xs text-gray-400">Sin suscripciones</p>
          ) : (
            data.map((p) => (
              <div key={p.planName} className="flex items-center gap-2 text-xs text-gray-700">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: DONUT_COLORS[p.planName] ?? DEFAULT_COLOR }}
                />
                {p.planName} — {p.count}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
