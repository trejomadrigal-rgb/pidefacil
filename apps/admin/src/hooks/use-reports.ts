import { useQuery } from '@tanstack/react-query';
import { getReportsDashboard } from '@/api/reports';

export function useReportsDashboard(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'dashboard', { startDate, endDate }],
    queryFn: () => getReportsDashboard(startDate, endDate),
    enabled: Boolean(startDate && endDate),
    staleTime: 60_000,
  });
}
