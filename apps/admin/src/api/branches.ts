import { api } from '@/lib/api';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface MenuSchedule {
  id: string;
  menuId: string;
  isActive: boolean;
  daysOfWeek: number[];
  menu: { id: string; name: string; type: string };
}

export interface ProductAvailabilityItem {
  productId: string;
  name: string;
  categoryName: string;
  defaultAvailable: boolean;
  branchAvailable: boolean;
  hasOverride: boolean;
}

export interface Device {
  id: string;
  name: string;
  deviceType: 'RECEPTION' | 'KITCHEN' | 'DELIVERY';
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED';
  lastSeenAt: string | null;
  branch?: { id: string; name: string } | null;
  user?: { id: string; name: string } | null;
}

export const getBranches = () => api.get<Branch[]>('/admin/branches').then((r) => r.data);
export const getBranch = (id: string) => api.get<Branch>(`/admin/branches/${id}`).then((r) => r.data);
export const createBranch = (data: Omit<Branch, 'id' | 'status' | 'createdAt'>) =>
  api.post<Branch>('/admin/branches', data).then((r) => r.data);
export const updateBranch = (id: string, data: Partial<Branch>) =>
  api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data);
export const deleteBranch = (id: string) => api.delete(`/admin/branches/${id}`);

export const getMenuSchedules = (branchId: string) =>
  api.get<MenuSchedule[]>(`/admin/branches/${branchId}/menu-schedules`).then((r) => r.data);
export const upsertMenuSchedules = (branchId: string, schedules: { menuId: string; isActive: boolean; daysOfWeek: number[] }[]) =>
  api.put<MenuSchedule[]>(`/admin/branches/${branchId}/menu-schedules`, { schedules }).then((r) => r.data);

export const getProductAvailability = (branchId: string) =>
  api.get<ProductAvailabilityItem[]>(`/admin/branches/${branchId}/product-availability`).then((r) => r.data);
export const updateProductAvailability = (branchId: string, items: { productId: string; isAvailable: boolean }[]) =>
  api.patch<ProductAvailabilityItem[]>(`/admin/branches/${branchId}/product-availability`, { items }).then((r) => r.data);

export const getDevices = () => api.get<Device[]>('/admin/devices').then((r) => r.data);
export const approveDevice = (id: string, branchId?: string) =>
  api.patch<Device>(`/admin/devices/${id}/approve`, { branchId }).then((r) => r.data);
export const blockDevice = (id: string) =>
  api.patch<Device>(`/admin/devices/${id}/block`).then((r) => r.data);
export const deleteDevice = (id: string) => api.delete(`/admin/devices/${id}`);
