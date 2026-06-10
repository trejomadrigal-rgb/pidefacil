// apps/admin/src/hooks/use-menus.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Menu {
  id: string;
  name: string;
  type: 'FIXED' | 'DAILY' | 'WEEKLY' | 'SPECIAL';
  status: 'DRAFT' | 'PUBLISHED';
  startDate?: string;
  endDate?: string;
  publishedAt?: string;
}

export function useMenus() {
  return useQuery<Menu[]>({
    queryKey: ['menus'],
    queryFn: async () => {
      const { data } = await api.get('/menus');
      return data;
    },
  });
}

export function useCreateMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Menu>) => api.post('/menus', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
  });
}

export function useUpdateMenu(menuId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Menu>) => api.patch(`/menus/${menuId}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
  });
}

export function usePublishMenu(menuId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`/menus/${menuId}/publish`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
  });
}

export function useDuplicateMenu(menuId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/menus/${menuId}/duplicate`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
  });
}

export function useDeleteMenu(menuId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/menus/${menuId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
  });
}
