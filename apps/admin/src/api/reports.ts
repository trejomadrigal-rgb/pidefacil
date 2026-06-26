import { api } from '@/lib/api';

export interface ReportsPeriod {
  startDate: string;
  endDate: string;
}

export interface ReportsSummary {
  totalRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  confirmedOrders: number;
  frequentCustomers: number;
  avgOrderValue: number;
  deliveryRate: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
}

export interface PeakHour {
  hour: number;
  orderCount: number;
}

export interface DailyTrend {
  date: string;
  orders: number;
  revenue: number;
}

export interface RevenueByPayment {
  cash: number;
  card: number;
  transfer: number;
}

export interface ReportsDashboard {
  period: ReportsPeriod;
  summary: ReportsSummary;
  topProducts: TopProduct[];
  peakHours: PeakHour[];
  dailyTrend: DailyTrend[];
  revenueByPayment: RevenueByPayment;
}

export async function getReportsDashboard(
  startDate: string,
  endDate: string,
): Promise<ReportsDashboard> {
  const res = await api.get<ReportsDashboard>('/reports/dashboard', {
    params: { startDate, endDate },
  });
  return res.data;
}
