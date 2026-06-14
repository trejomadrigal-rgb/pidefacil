import { api } from '@/lib/api';

export interface Liquidation {
  id: string;
  amount: number;
  notes?: string;
  settledAt: string;
  branch: { name: string };
  deliveryUser: { name: string };
  receivedBy: { name: string };
}

export const getLiquidations = (branchId?: string) =>
  api.get<Liquidation[]>('/admin/liquidations', { params: branchId ? { branchId } : {} }).then((r) => r.data);

export const createLiquidation = (data: { branchId: string; receivedById: string; amount: number; notes?: string }) =>
  api.post<Liquidation>('/admin/liquidations', data).then((r) => r.data);
