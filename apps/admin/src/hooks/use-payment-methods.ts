import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  type BusinessPaymentMethod,
} from '@/api/payment-methods';

const QK = ['payment-methods'];

export const usePaymentMethods = () =>
  useQuery({ queryKey: QK, queryFn: getPaymentMethods });

export const useCreatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useUpdatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<BusinessPaymentMethod, 'label' | 'requiresConfirmation' | 'isActive'>>;
    }) => updatePaymentMethod(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useDeletePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};
