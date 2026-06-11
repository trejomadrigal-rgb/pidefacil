import { apiClient } from './client';

export interface MobileNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  data: MobileNotification[];
  unreadCount: number;
}

export async function getNotifications(): Promise<NotificationsResponse> {
  const res = await apiClient.get<NotificationsResponse>('/notifications');
  return res.data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}
