import { api } from '@/lib/api';

export type WhatsappStatus = 'open' | 'connecting' | 'close' | 'not_configured';

export async function getWhatsappStatus(): Promise<{ status: WhatsappStatus }> {
  const { data } = await api.get('/admin/whatsapp/status');
  return data;
}

export async function getWhatsappQr(): Promise<{ qr: string | null }> {
  const { data } = await api.get('/admin/whatsapp/qr');
  return data;
}

export async function connectWhatsapp(): Promise<{ status: string; qr: string }> {
  const { data } = await api.post('/admin/whatsapp/connect');
  return data;
}

export async function disconnectWhatsapp(): Promise<void> {
  await api.delete('/admin/whatsapp/disconnect');
}
