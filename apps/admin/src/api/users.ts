import { api } from '@/lib/api';

export const getDeliveryUsers = () =>
  api.get<Array<{ id: string; name: string; email: string }>>('/business/me/users?role=DELIVERY').then((r) => r.data);
