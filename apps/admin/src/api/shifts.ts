import { api } from '@/lib/api';

export interface Shift {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  deliveryUser: { id: string; name: string };
  openedBy: { id: string; name: string };
  liquidations: Array<{
    id: string;
    status: 'OPEN' | 'CLOSED';
    cashTotal: number;
    cardTotal: number;
    transferTotal: number;
    orders: Array<{ id: string; orderNumber: string; status: string; total: number; paymentMethod: string | null; customerName: string; deliveryAddress: string | null }>;
  }>;
}

export const getShifts = () =>
  api.get<Shift[]>('/shifts').then((r) => r.data);

export const getShift = (id: string) =>
  api.get<Shift>(`/shifts/${id}`).then((r) => r.data);

export const createShift = (data: { deliveryUserId: string; branchId?: string }) =>
  api.post<Shift>('/shifts', data).then((r) => r.data);

export const closeShift = (id: string) =>
  api.patch<Shift>(`/shifts/${id}/close`).then((r) => r.data);

export const createTrip = (shiftId: string, data: { orderIds: string[] }) =>
  api.post(`/shifts/${shiftId}/trips`, data).then((r) => r.data);

export const closeTrip = (tripId: string) =>
  api.patch(`/liquidations/${tripId}/close`).then((r) => r.data);
