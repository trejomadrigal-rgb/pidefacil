import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyDeliveryOrders, markOutForDelivery, confirmDelivery, notifyReturn } from '../api/delivery';

export const useDeliveryOrders = () =>
  useQuery({
    queryKey: ['delivery-orders'],
    queryFn: getMyDeliveryOrders,
    refetchInterval: 30_000,
  });

export const useMarkOutForDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markOutForDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-orders'] }),
  });
};

export const useConfirmDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-orders'] }),
  });
};

export const useNotifyReturn = () =>
  useMutation({ mutationFn: notifyReturn });
