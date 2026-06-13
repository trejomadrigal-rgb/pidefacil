'use client';

import { useSaBusinesses, useSaDashboard } from '@/hooks/use-super-admin';
import { SaBizTable } from './components/sa-biz-table';
import { SaKpiCards } from './components/sa-kpi-cards';
import { SaNewBizChart } from './components/sa-new-biz-chart';
import { SaPlanDonut } from './components/sa-plan-donut';

const EMPTY_DASHBOARD = {
  mrr: 0,
  activeBusinesses: 0,
  trialBusinesses: 0,
  totalOrders30d: 0,
  businessesByPlan: [],
  newBusinesses30d: [],
};

export default function SuperDashboardPage() {
  const { data: dashboard = EMPTY_DASHBOARD, isLoading: dashLoading } = useSaDashboard();
  const { data: businesses = [] } = useSaBusinesses();

  return (
    <div className="p-8 h-full overflow-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Dashboard SaaS</h1>

      {dashLoading ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <SaKpiCards
          mrr={dashboard.mrr}
          activeBusinesses={dashboard.activeBusinesses}
          trialBusinesses={dashboard.trialBusinesses}
          totalOrders30d={dashboard.totalOrders30d}
        />
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <SaPlanDonut data={dashboard.businessesByPlan} />
        <SaNewBizChart data={dashboard.newBusinesses30d} />
      </div>

      <SaBizTable businesses={businesses} />
    </div>
  );
}
