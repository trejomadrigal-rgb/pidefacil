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

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryAddress: string | null;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  isPaid: boolean;
  transferConfirmed: boolean;
  total: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  notes: string | null;
  createdAt: string;
  items: { name: string; quantity: number; price: number; subtotal: number; notes: string | null }[];
  customer: { id: string; name: string; phone: string; notes: string | null; trustLevel: string } | null;
  customPaymentMethod: { requiresConfirmation: boolean } | null;
}

// GET /orders/:id — order detail
export const getOrderById = (id: string): Promise<OrderDetail> =>
  api.get(`/orders/${id}`).then((r) => r.data);

// GET /orders?status=READY — orders that can be assigned to a trip
export const getReadyOrders = (): Promise<ReadyOrder[]> =>
  api.get('/orders?status=READY').then((r) => r.data);

// GET /orders?status=CONFIRMED — orders awaiting transfer confirmation
export const getPendingTransferOrders = (): Promise<ReadyOrder[]> =>
  api.get('/orders?status=CONFIRMED').then((r) => r.data);

// GET /orders?status=X — all active orders (today), optional status filter
export const getOrders = (status?: string): Promise<ReadyOrder[]> =>
  api.get(`/orders${status ? `?status=${status}` : ''}`).then((r) => r.data);

// PATCH /orders/:id/status — advance order to next status
export const updateOrderStatus = (id: string, status: string): Promise<OrderDetail> =>
  api.patch(`/orders/${id}/status`, { status }).then((r) => r.data);

// PATCH /orders/:id/confirm-transfer — confirm bank transfer and move order to IN_PREPARATION
export const confirmTransfer = (orderId: string) =>
  api.patch(`/orders/${orderId}/confirm-transfer`).then((r) => r.data);

export interface CreateManualOrderPayload {
  businessId: string;
  customer: { name: string; phone: string };
  deliveryType: 'PICKUP' | 'DELIVERY';
  address?: { street: string; references?: string };
  notes?: string;
  paymentMethodId?: string;
  items: { productId: string; variantId?: string; quantity: number }[];
}

export interface CreateManualOrderResult {
  id: string;
  orderNumber: string;
  status: string;
}

// POST /public/orders — crear pedido manual desde admin (mismo endpoint que el QR)
export const createManualOrder = (payload: CreateManualOrderPayload): Promise<CreateManualOrderResult> =>
  api.post('/public/orders', payload).then((r) => r.data);
