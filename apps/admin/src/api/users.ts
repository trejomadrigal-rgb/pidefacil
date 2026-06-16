import { api } from '@/lib/api';

export type UserRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'KITCHEN' | 'MENU_DESIGNER' | 'DELIVERY';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface BusinessUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export const getUsers = () =>
  api.get<BusinessUser[]>('/business/me/users').then((r) => r.data);

export const getDeliveryUsers = () =>
  api.get<Array<{ id: string; name: string; email: string }>>('/business/me/users?role=DELIVERY').then((r) => r.data);

export const resetUserPassword = (userId: string, newPassword: string) =>
  api.patch(`/business/me/users/${userId}/reset-password`, { newPassword });
