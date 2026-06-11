import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCustomer, type TrustLevel } from '../api/customers';

export function useUpdateCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { notes?: string; trustLevel?: TrustLevel }) =>
      updateCustomer(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', customerId] });
    },
  });
}
