import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/liquidations';

export const useLiquidations = (branchId?: string) =>
  useQuery({ queryKey: ['liquidations', branchId], queryFn: () => api.getLiquidations(branchId) });

export const useCreateLiquidation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLiquidation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liquidations'] }),
  });
};
