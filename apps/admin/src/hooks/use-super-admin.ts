'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateBusinessPayload,
  SaBusiness,
  UpdateSubscriptionPayload,
  UpsertSubscriptionPayload,
  activateSaBusiness,
  createSaBusiness,
  createSaPlan,
  deleteSaPlan,
  getSaBusiness,
  getSaBusinesses,
  getSaDashboard,
  getSaPlans,
  suspendSaBusiness,
  updateSaBusiness,
  updateSaPlan,
  updateSaSubscription,
  upsertSaSubscription,
} from '@/api/super-admin';

export function useSaDashboard() {
  return useQuery({ queryKey: ['sa', 'dashboard'], queryFn: getSaDashboard, staleTime: 60_000 });
}

export function useSaPlans() {
  return useQuery({ queryKey: ['sa', 'plans'], queryFn: getSaPlans, staleTime: 60_000 });
}

export function useCreateSaPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSaPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'plans'] }),
  });
}

export function useUpdateSaPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSaPlan>[1] }) =>
      updateSaPlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'plans'] }),
  });
}

export function useDeleteSaPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSaPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'plans'] }),
  });
}

export function useSaBusinesses(status?: SaBusiness['status']) {
  return useQuery({
    queryKey: ['sa', 'businesses', 'list', status],
    queryFn: () => getSaBusinesses(status),
    staleTime: 30_000,
  });
}

export function useSaBusiness(id: string) {
  return useQuery({
    queryKey: ['sa', 'businesses', 'detail', id],
    queryFn: () => getSaBusiness(id),
    staleTime: 30_000,
  });
}

export function useCreateSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBusinessPayload) => createSaBusiness(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'list'] }),
  });
}

export function useUpdateSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSaBusiness>[1] }) =>
      updateSaBusiness(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'list'] });
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'detail', vars.id] });
    },
  });
}

export function useSuspendSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: suspendSaBusiness,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'list'] });
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'detail', id] });
    },
  });
}

export function useActivateSaBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateSaBusiness,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'list'] });
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'detail', id] });
    },
  });
}

export function useUpsertSaSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertSubscriptionPayload) => upsertSaSubscription(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'detail', vars.businessId] });
      qc.invalidateQueries({ queryKey: ['sa', 'dashboard'] });
    },
  });
}

export function useUpdateSaSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubscriptionPayload }) =>
      updateSaSubscription(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'businesses', 'list'] });
      qc.invalidateQueries({ queryKey: ['sa', 'dashboard'] });
    },
  });
}
