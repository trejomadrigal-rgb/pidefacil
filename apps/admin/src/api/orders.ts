import { api } from '@/lib/api';

export interface ReadyOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryAddress: string | null;
  paymentMethod: string | null;
  transferConfirmed: boolean;
  liquidationId: string | null;
  total: number;
  itemCount: number;
  createdAt: string;
}

// GET /orders?status=READY — orders that can be assigned to a trip
export const getReadyOrders = (): Promise<ReadyOrder[]> =>
  api.get('/orders?status=READY').then((r) => r.data);

// PATCH /orders/:id/confirm-transfer — confirm bank transfer and move order to IN_PREPARATION
export const confirmTransfer = (orderId: string) =>
  api.patch(`/orders/${orderId}/confirm-transfer`).then((r) => r.data);
