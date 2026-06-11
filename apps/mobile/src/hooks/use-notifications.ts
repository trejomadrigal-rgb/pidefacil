import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../api/notifications';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 60_000,
  });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data?.unreadCount ?? 0;
}
