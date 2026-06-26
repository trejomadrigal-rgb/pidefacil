'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { SaBusiness } from '@/api/super-admin';

const PLAN_BADGE: Record<string, { bg: string; text: string }> = {
  Básico: { bg: '#F3F4F6', text: '#6B7280' },
  Pro: { bg: '#FEF3C7', text: '#D97706' },
  Plus: { bg: '#EDE9FE', text: '#7C3AED' },
};
const DEFAULT_BADGE = PLAN_BADGE['Básico'];

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-green-600',
  TRIAL: 'text-blue-500',
  SUSPENDED: 'text-red-500',
  INACTIVE: 'text-gray-400',
};

interface Props { businesses: SaBusiness[]; }

export function SaBizTable({ businesses }: Props) {
  if (businesses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
        Sin negocios registrados
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-[1fr_100px_90px_90px] px-4 py-2 bg-gray-50 border-b border-gray-200">
        {['Negocio', 'Plan', 'Estado', 'Vence'].map((h) => (
          <span key={h} className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            {h}
          </span>
        ))}
      </div>
      {businesses.map((biz, i) => {
        const planName = biz.subscription?.plan?.name ?? null;
        const badge = planName ? (PLAN_BADGE[planName] ?? DEFAULT_BADGE) : DEFAULT_BADGE;
        const subStatus = biz.subscription?.status ?? biz.status;
        const endDate = biz.subscription?.endDate
          ? new Date(biz.subscription.endDate).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
            })
          : '—';
        return (
          <motion.div
            key={biz.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.3) }}
          >
            <Link
              href={`/super/negocios/${biz.id}`}
              className="grid grid-cols-[1fr_100px_90px_90px] px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
            >
              <div>
                <p className="text-sm font-bold text-gray-900">{biz.name}</p>
                <p className="text-[11px] text-gray-400">{biz.slug}</p>
              </div>
              <div>
                {planName ? (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {planName}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">Sin plan</span>
                )}
              </div>
              <div className={`text-[11px] font-bold ${STATUS_COLOR[subStatus] ?? 'text-gray-400'}`}>
                {subStatus}
              </div>
              <div className="text-[11px] text-gray-500">{endDate}</div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
