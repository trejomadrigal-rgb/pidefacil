import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShifts, getShift, createShift, closeShift, createTrip, closeTrip } from '@/api/shifts';
import { confirmTransfer, getReadyOrders, getPendingTransferOrders } from '@/api/orders';

export const useShifts = () =>
  useQuery({ queryKey: ['shifts'], queryFn: getShifts });

export const useShift = (id: string) =>
  useQuery({ queryKey: ['shifts', id], queryFn: () => getShift(id), enabled: !!id });

export const useCreateShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
};

export const useCloseShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closeShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
};

export const useCreateTrip = (shiftId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) => createTrip(shiftId, { orderIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts', shiftId] }),
  });
};

export const useCloseTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closeTrip,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
};

export const useReadyOrders = () =>
  useQuery({ queryKey: ['orders', 'ready'], queryFn: getReadyOrders });

export const usePendingTransferOrders = () =>
  useQuery({
    queryKey: ['orders', 'pending-transfer'],
    queryFn: getPendingTransferOrders,
  });

export const useConfirmTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
};
