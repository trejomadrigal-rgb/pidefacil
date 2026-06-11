import { useQuery } from '@tanstack/react-query';
import { getOrder } from '../api/orders';

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id!),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: !!id,
  });
}
