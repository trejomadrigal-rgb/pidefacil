import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/branches';

export const useBranches = () =>
  useQuery({ queryKey: ['branches'], queryFn: api.getBranches });

export const useBranch = (id: string) =>
  useQuery({ queryKey: ['branches', id], queryFn: () => api.getBranch(id), enabled: !!id });

export const useCreateBranch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBranch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
};

export const useUpdateBranch = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.updateBranch>[1]) => api.updateBranch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
};

export const useDeleteBranch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteBranch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
};

export const useMenuSchedules = (branchId: string) =>
  useQuery({ queryKey: ['branches', branchId, 'schedules'], queryFn: () => api.getMenuSchedules(branchId), enabled: !!branchId });

export const useUpsertMenuSchedules = (branchId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schedules: Parameters<typeof api.upsertMenuSchedules>[1]) => api.upsertMenuSchedules(branchId, schedules),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches', branchId, 'schedules'] }),
  });
};

export const useProductAvailability = (branchId: string) =>
  useQuery({ queryKey: ['branches', branchId, 'availability'], queryFn: () => api.getProductAvailability(branchId), enabled: !!branchId });

export const useUpdateProductAvailability = (branchId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Parameters<typeof api.updateProductAvailability>[1]) => api.updateProductAvailability(branchId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches', branchId, 'availability'] }),
  });
};

export const useDevices = () =>
  useQuery({ queryKey: ['devices'], queryFn: api.getDevices });

export const useApproveDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId?: string }) => api.approveDevice(id, branchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
};

export const useBlockDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.blockDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
};
