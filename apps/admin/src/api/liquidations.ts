import { api } from '@/lib/api';

export interface Liquidation {
  id: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  notes: string | null;
  shift: {
    deliveryUser: { name: string };
    openedAt: string;
  };
  confirmedBy: { name: string } | null;
  orders: Array<{ id: string; orderNumber: string; status: string; total: number }>;
}

export const getLiquidations = () =>
  api.get<Liquidation[]>('/liquidations').then((r) => r.data);
