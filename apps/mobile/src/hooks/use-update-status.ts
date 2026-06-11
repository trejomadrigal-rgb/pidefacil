import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrderStatus } from '../api/orders';
import { type OrderStatus } from '../constants/order-status';

export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
    },
  });
}
