import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShifts, getShift, createShift, closeShift } from '@/api/shifts';

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
