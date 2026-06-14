import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/whatsapp';

export const useWhatsappStatus = (refetchInterval?: number) =>
  useQuery({
    queryKey: ['whatsapp', 'status'],
    queryFn: api.getWhatsappStatus,
    refetchInterval,
  });

export const useWhatsappQr = (enabled: boolean) =>
  useQuery({
    queryKey: ['whatsapp', 'qr'],
    queryFn: api.getWhatsappQr,
    enabled,
    refetchInterval: enabled ? 20_000 : false,
  });

export const useConnectWhatsapp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.connectWhatsapp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp'] }),
  });
};

export const useDisconnectWhatsapp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.disconnectWhatsapp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp'] }),
  });
};
