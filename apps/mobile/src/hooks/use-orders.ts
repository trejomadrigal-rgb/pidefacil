import { useQuery } from '@tanstack/react-query';
import { getOrders } from '../api/orders';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
