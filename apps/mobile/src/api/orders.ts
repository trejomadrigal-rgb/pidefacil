import { apiClient } from './client';
import { type OrderStatus } from '../constants/order-status';

export type TrustLevel = 'NEW' | 'FREQUENT' | 'TRUSTED' | 'RISK' | 'BLOCKED';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  total: number;
  itemCount: number;
  createdAt: string;
  customerTrustLevel: TrustLevel | null;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  notes: string | null;
}

export interface CustomerSnippet {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  trustLevel: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryAddress: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  customer: CustomerSnippet | null;
}

export const getOrders = async (): Promise<OrderListItem[]> => {
  const { data } = await apiClient.get<OrderListItem[]>('/orders');
  return data;
};

export const getOrder = async (id: string): Promise<OrderDetail> => {
  const { data } = await apiClient.get<OrderDetail>(`/orders/${id}`);
  return data;
};

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<OrderDetail> => {
  const { data } = await apiClient.patch<OrderDetail>(`/orders/${id}/status`, { status });
  return data;
};
