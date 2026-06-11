import { apiClient } from './client';

export type TrustLevel = 'NEW' | 'FREQUENT' | 'TRUSTED' | 'RISK' | 'BLOCKED';

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  trustLevel: TrustLevel;
  totalOrders: number;
  lastOrderAt: string | null;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  trustLevel: TrustLevel;
  totalOrders: number;
  createdAt: string;
  orders: CustomerOrder[];
}

export interface CustomersResponse {
  data: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
}

export const getCustomers = async (params?: {
  trustLevel?: TrustLevel;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<CustomersResponse> => {
  const { data } = await apiClient.get<CustomersResponse>('/customers', { params });
  return data;
};

export const getCustomer = async (id: string): Promise<CustomerDetail> => {
  const { data } = await apiClient.get<CustomerDetail>(`/customers/${id}`);
  return data;
};

export const updateCustomer = async (
  id: string,
  body: { notes?: string; trustLevel?: TrustLevel },
): Promise<CustomerDetail> => {
  const { data } = await apiClient.patch<CustomerDetail>(`/customers/${id}`, body);
  return data;
};
