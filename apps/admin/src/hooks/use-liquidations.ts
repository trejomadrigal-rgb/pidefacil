import { useQuery } from '@tanstack/react-query';
import { getLiquidations } from '@/api/liquidations';

export const useLiquidations = () =>
  useQuery({ queryKey: ['liquidations'], queryFn: getLiquidations });
