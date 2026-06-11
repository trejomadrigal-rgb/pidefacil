// apps/admin/src/hooks/use-products.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Variant { id: string; name: string; price?: number }
export interface Extra { id: string; name: string; price: number }
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  categoryId: string;
  variants: Variant[];
  extras: Extra[];
}

export function useProducts(categoryId?: string) {
  return useQuery<Product[]>({
    queryKey: ['products', { categoryId }],
    queryFn: async () => {
      const params = categoryId ? `?categoryId=${categoryId}` : '';
      const { data } = await api.get(`/products${params}`);
      return data.map((p: Product) => ({ ...p, price: Number(p.price) }));
    },
    enabled: !!categoryId,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Product>) => api.post('/products', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Product>) =>
      api.patch(`/products/${productId}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useToggleAvailability(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`/products/${productId}/availability`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/products/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useAddVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; price?: number }) =>
      api.post(`/products/${productId}/variants`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) => api.delete(`/products/${productId}/variants/${variantId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useAddExtra(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; price: number }) =>
      api.post(`/products/${productId}/extras`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteExtra(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (extraId: string) => api.delete(`/products/${productId}/extras/${extraId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useReorderProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      api.patch('/products/reorder', { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    },
  });
}
