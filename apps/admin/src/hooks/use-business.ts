// apps/admin/src/hooks/use-business.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Business {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  description?: string;
  address?: string;
  logoUrl?: string;
  hours?: string;
}

export function useBusiness() {
  return useQuery<Business>({
    queryKey: ['business'],
    queryFn: async () => {
      const { data } = await api.get('/business/me');
      return data;
    },
  });
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Business>) =>
      api.patch('/business/me', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business'] }),
  });
}
