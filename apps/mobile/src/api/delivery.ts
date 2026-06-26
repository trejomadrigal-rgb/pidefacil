import { apiClient } from './client';

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  total: string;
  paymentMethod: string | null;
  notes: string | null;
  items: Array<{
    quantity: number;
    price: number;
    subtotal: number;
    product: { name: string };
  }>;
}

export interface DeliveryOrdersResponse {
  tripId: string | null;
  totalOrdersInTrip: number;
  orders: DeliveryOrder[];
}

export const getMyDeliveryOrders = () =>
  apiClient.get<DeliveryOrdersResponse>('/delivery/orders').then((r) => r.data);

export const markOutForDelivery = (orderId: string) =>
  apiClient.patch<DeliveryOrder>(`/delivery/orders/${orderId}/out-for-delivery`).then((r) => r.data);

export const confirmDelivery = (orderId: string) =>
  apiClient.patch<DeliveryOrder>(`/delivery/orders/${orderId}/deliver`).then((r) => r.data);

export const notifyReturn = () =>
  apiClient.post('/delivery/notify-return').then((r) => r.data);
