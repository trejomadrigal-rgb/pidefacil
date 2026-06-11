import { useQuery } from '@tanstack/react-query';
import { getCustomer } from '../api/customers';

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}
