import type { SaNewBiz } from '@/api/super-admin';

interface Props { data: SaNewBiz[]; }

export function SaNewBizChart({ data }: Props) {
  const maxCount = data.reduce((m, d) => Math.max(m, d.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Nuevos negocios (30d)
      </p>
      <div className="flex items-end gap-0.5 h-10">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-[#FF6B35]/70"
            style={{
              height: d.count > 0 ? `${(d.count / maxCount) * 100}%` : '4px',
              opacity: d.count > 0 ? 0.8 : 0.2,
            }}
            title={`${d.date}: ${d.count}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-400">{data[0]?.date.slice(5) ?? ''}</span>
        <span className="text-[9px] text-gray-400">{data[14]?.date.slice(5) ?? ''}</span>
        <span className="text-[9px] text-gray-400">{data[29]?.date.slice(5) ?? ''}</span>
      </div>
    </div>
  );
}
