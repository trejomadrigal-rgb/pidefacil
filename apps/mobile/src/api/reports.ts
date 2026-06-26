import { apiClient } from './client';

export interface ReportsSummary {
  totalRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  confirmedOrders: number;
  frequentCustomers: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
}

export interface ReportsDashboard {
  period: { startDate: string; endDate: string };
  summary: ReportsSummary;
  topProducts: TopProduct[];
  peakHours: { hour: number; orderCount: number }[];
}

export type ReportPeriod = 'today' | '7d' | '30d';

export function getDateRange(period: ReportPeriod): { startDate: string; endDate: string } {
  const now = new Date();
  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  if (period === 'today') {
    const d = toDateStr(now);
    return { startDate: d, endDate: d };
  }
  if (period === '7d') {
    return {
      startDate: toDateStr(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
      endDate: toDateStr(now),
    };
  }
  return {
    startDate: toDateStr(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)),
    endDate: toDateStr(now),
  };
}

export async function getReportsDashboard(
  startDate: string,
  endDate: string,
): Promise<ReportsDashboard> {
  const res = await apiClient.get<ReportsDashboard>('/reports/dashboard', {
    params: { startDate, endDate },
  });
  return res.data;
}
