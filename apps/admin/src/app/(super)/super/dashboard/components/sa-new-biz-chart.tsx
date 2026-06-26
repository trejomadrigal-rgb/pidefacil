'use client';

import { motion } from 'framer-motion';
import type { SaNewBiz } from '@/api/super-admin';

interface Props { data: SaNewBiz[]; }

export function SaNewBizChart({ data }: Props) {
  const maxCount = data.reduce((m, d) => Math.max(m, d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Nuevos negocios (30d)
        </p>
        <p className="text-lg font-black text-[#FF6B35]">{total}</p>
      </div>
      <div className="flex items-end gap-0.5 h-10">
        {data.map((d, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-sm bg-[#FF6B35]/70"
            title={`${d.date}: ${d.count}`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: i * 0.01, ease: 'easeOut' }}
            style={{
              height: d.count > 0 ? `${(d.count / maxCount) * 100}%` : '4px',
              opacity: d.count > 0 ? 0.8 : 0.2,
              originY: '100%',
            }}
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
