import { apiClient } from './client';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  notes: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryAddress: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export const getOrders = async (): Promise<OrderListItem[]> => {
  const { data } = await apiClient.get<OrderListItem[]>('/orders');
  return data;
};

export const getOrder = async (id: string): Promise<OrderDetail> => {
  const { data } = await apiClient.get<OrderDetail>(`/orders/${id}`);
  return data;
};

export const updateOrderStatus = async (id: string, status: string): Promise<OrderDetail> => {
  const { data } = await apiClient.patch<OrderDetail>(`/orders/${id}/status`, { status });
  return data;
};
