import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

export function useCustomers(params?: { trustLevel?: TrustLevel; search?: string }) {
  return useQuery<CustomersResponse>({
    queryKey: ['customers', params],
    queryFn: async () => {
      const { data } = await api.get('/customers', { params });
      return data;
    },
  });
}

export function useCustomer(id: string) {
  return useQuery<CustomerDetail>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { notes?: string; trustLevel?: TrustLevel }) =>
      api.patch(`/customers/${customerId}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', customerId] });
    },
  });
}
