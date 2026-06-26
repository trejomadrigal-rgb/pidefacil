import { useQuery } from '@tanstack/react-query';
import { getReportsDashboard, getDateRange, type ReportPeriod } from '../api/reports';

export type { ReportPeriod };

export function useReportsDashboard(period: ReportPeriod) {
  return useQuery({
    queryKey: ['reports', 'dashboard', period],
    queryFn: () => {
      const { startDate, endDate } = getDateRange(period);
      return getReportsDashboard(startDate, endDate);
    },
    staleTime: 60_000,
  });
}
