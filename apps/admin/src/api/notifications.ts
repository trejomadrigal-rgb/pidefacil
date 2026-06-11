import { api } from '@/lib/api';

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  data: AdminNotification[];
  unreadCount: number;
}

export async function getNotifications(): Promise<NotificationsResponse> {
  const res = await api.get<NotificationsResponse>('/notifications');
  return res.data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
