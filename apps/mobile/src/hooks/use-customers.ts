import { useQuery } from '@tanstack/react-query';
import { getCustomers, type TrustLevel } from '../api/customers';

export function useCustomers(filters?: { trustLevel?: TrustLevel; search?: string }) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
    staleTime: 30_000,
  });
}
