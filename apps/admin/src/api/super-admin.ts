import { api } from '@/lib/api';

export interface SaBizByPlan { planName: string; count: number; }
export interface SaNewBiz { date: string; count: number; }

export interface SaDashboard {
  mrr: number;
  activeBusinesses: number;
  trialBusinesses: number;
  totalOrders30d: number;
  businessesByPlan: SaBizByPlan[];
  newBusinesses30d: SaNewBiz[];
}

export interface SaPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  maxUsers: number;
  maxBranches: number;
  maxDevices: number;
}

export interface SaSubscription {
  id: string;
  businessId: string;
  planId: string;
  startDate: string;
  endDate: string | null;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  plan: SaPlan;
}

export interface SaBusiness {
  id: string;
  name: string;
  slug: string;
  phone: string;
  whatsapp: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  createdAt: string;
  subscription: SaSubscription | null;
}

export interface CreateBusinessPayload {
  businessName: string;
  slug: string;
  phone: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface UpsertSubscriptionPayload {
  businessId: string;
  planId: string;
  startDate: string;
  endDate?: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
}

export interface UpdateSubscriptionPayload {
  planId?: string;
  startDate?: string;
  endDate?: string | null;
  status?: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
}

export async function getSaDashboard(): Promise<SaDashboard> {
  return (await api.get<SaDashboard>('/super-admin/dashboard')).data;
}

export async function getSaPlans(): Promise<SaPlan[]> {
  return (await api.get<SaPlan[]>('/super-admin/plans')).data;
}

export async function createSaPlan(data: Omit<SaPlan, 'id'>): Promise<SaPlan> {
  return (await api.post<SaPlan>('/super-admin/plans', data)).data;
}

export async function updateSaPlan(id: string, data: Partial<Omit<SaPlan, 'id'>>): Promise<SaPlan> {
  return (await api.patch<SaPlan>(`/super-admin/plans/${id}`, data)).data;
}

export async function deleteSaPlan(id: string): Promise<void> {
  await api.delete(`/super-admin/plans/${id}`);
}

export async function getSaBusinesses(status?: SaBusiness['status']): Promise<SaBusiness[]> {
  return (await api.get<SaBusiness[]>('/super-admin/businesses', { params: status ? { status } : undefined })).data;
}

export async function getSaBusiness(id: string): Promise<SaBusiness> {
  return (await api.get<SaBusiness>(`/super-admin/businesses/${id}`)).data;
}

export async function createSaBusiness(
  data: CreateBusinessPayload,
): Promise<{ business: SaBusiness; owner: { id: string; role: string } }> {
  return (await api.post('/super-admin/businesses', data)).data;
}

export async function updateSaBusiness(
  id: string,
  data: { name?: string; phone?: string; whatsapp?: string; timezone?: string },
): Promise<SaBusiness> {
  return (await api.patch<SaBusiness>(`/super-admin/businesses/${id}`, data)).data;
}

export async function suspendSaBusiness(id: string): Promise<SaBusiness> {
  return (await api.post<SaBusiness>(`/super-admin/businesses/${id}/suspend`)).data;
}

export async function activateSaBusiness(id: string): Promise<SaBusiness> {
  return (await api.post<SaBusiness>(`/super-admin/businesses/${id}/activate`)).data;
}

export async function upsertSaSubscription(data: UpsertSubscriptionPayload): Promise<SaSubscription> {
  return (await api.post<SaSubscription>('/super-admin/subscriptions', data)).data;
}

export async function updateSaSubscription(
  id: string,
  data: UpdateSubscriptionPayload,
): Promise<SaSubscription> {
  return (await api.patch<SaSubscription>(`/super-admin/subscriptions/${id}`, data)).data;
}
