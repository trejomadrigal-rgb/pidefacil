// apps/admin/src/hooks/use-categories.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Category {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  menuId?: string;
  sortOrder: number;
}

export function useCategories(menuId?: string) {
  return useQuery<Category[]>({
    queryKey: ['categories', { menuId }],
    queryFn: async () => {
      const params = menuId ? `?menuId=${menuId}` : '';
      const { data } = await api.get(`/categories${params}`);
      return data;
    },
    enabled: !!menuId,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Category>) => api.post('/categories', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Category>) =>
      api.patch(`/categories/${categoryId}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/categories/${categoryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      api.patch('/categories/reorder', { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
