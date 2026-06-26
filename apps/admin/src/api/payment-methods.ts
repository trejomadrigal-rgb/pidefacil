import { api } from '@/lib/api';

export interface BusinessPaymentMethod {
  id: string;
  label: string;
  requiresConfirmation: boolean;
  isActive: boolean;
  position: number;
  createdAt: string;
}

export const getPaymentMethods = () =>
  api.get<BusinessPaymentMethod[]>('/admin/payment-methods').then((r) => r.data);

export const createPaymentMethod = (data: { label: string; requiresConfirmation: boolean }) =>
  api.post<BusinessPaymentMethod>('/admin/payment-methods', data).then((r) => r.data);

export const updatePaymentMethod = (
  id: string,
  data: Partial<{ label: string; requiresConfirmation: boolean; isActive: boolean }>,
) => api.patch<BusinessPaymentMethod>(`/admin/payment-methods/${id}`, data).then((r) => r.data);

export const deletePaymentMethod = (id: string) =>
  api.delete(`/admin/payment-methods/${id}`);
