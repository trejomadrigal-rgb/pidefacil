'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  useWhatsappStatus,
  useWhatsappQr,
  useConnectWhatsapp,
  useDisconnectWhatsapp,
} from '@/hooks/use-whatsapp';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const MESSAGE_PREVIEWS = [
  { emoji: '✅', label: 'Al confirmar', text: 'Pedido #42 confirmado — Ya lo estamos preparando. 🍳' },
  { emoji: '🍽️', label: 'Listo para recoger', text: 'Pedido #42 listo — ¡Pasa por él!' },
  { emoji: '🚗', label: 'En camino', text: 'Pedido #42 en camino — ¡Prepárate!' },
  { emoji: '🎉', label: 'Entregado', text: 'Pedido #42 entregado — ¡Buen provecho!' },
  { emoji: '❌', label: 'Cancelado', text: 'Pedido #42 cancelado — Disculpa el inconveniente.' },
];

export default function WhatsappPage() {
  const { data: statusData, isLoading } = useWhatsappStatus(5_000);
  const status = statusData?.status ?? 'not_configured';

  const isConnecting = status === 'connecting';
  const isConnected = status === 'open';

  const { data: qrData } = useWhatsappQr(isConnecting);
  const connect = useConnectWhatsapp();
  const disconnect = useDisconnectWhatsapp();

  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const handleTest = async () => {
    if (!testPhone.trim()) return;
    setTestLoading(true);
    try {
      const res = await api.post<{ ok: boolean; error?: string }>('/admin/whatsapp/test', { phone: testPhone.trim() });
      if (res.data.ok) {
        toast.success('✅ Mensaje enviado — revisa tu WhatsApp');
      } else {
        toast.error(res.data.error ?? 'No se pudo enviar el mensaje');
      }
    } catch {
      toast.error('Error al conectar con el servidor');
    } finally {
      setTestLoading(false);
    }
  };

  const handleConnect = async () => {
    await connect.mutateAsync();
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Los clientes dejarán de recibir notificaciones automáticas.')) return;
    await disconnect.mutateAsync();
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>;
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <h1 className="font-jakarta font-bold text-brand-900 text-xl">WhatsApp</h1>
        <p className="text-sm text-gray-400 mt-1">
          Notifica a tus clientes automáticamente en cada cambio de estado.
        </p>
      </div>

      {/* Estado: no configurado o desconectado */}
      {(status === 'not_configured' || status === 'close') && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="font-bold text-gray-900 mb-1">Conecta tu WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-6">
            Los mensajes se enviarán desde el número de WhatsApp de tu negocio.
          </p>
          <button
            onClick={handleConnect}
            disabled={connect.isPending}
            className="bg-green-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-600 disabled:opacity-50"
          >
            {connect.isPending ? 'Conectando...' : 'Conectar WhatsApp'}
          </button>
          {connect.isError && (
            <p className="text-sm text-red-500 mt-3">Error al conectar. Intenta de nuevo.</p>
          )}
        </div>
      )}

      {/* Estado: escaneando QR */}
      {isConnecting && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-semibold text-amber-600">Esperando escaneo…</span>
          </div>

          {qrData?.qr ? (
            <div className="flex justify-center mb-4">
              <Image
                src={qrData.qr}
                alt="WhatsApp QR Code"
                width={220}
                height={220}
                className="rounded-lg border border-gray-100"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-[220px] h-[220px] mx-auto bg-gray-100 rounded-lg animate-pulse mb-4" />
          )}

          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside mb-4">
            <li>Abre WhatsApp en tu celular</li>
            <li>Ve a <strong>Menú → Dispositivos vinculados</strong></li>
            <li>Toca <strong>Vincular dispositivo</strong></li>
            <li>Escanea este código QR</li>
          </ol>

          <p className="text-xs text-gray-400 mb-4">El código se actualiza cada 5 segundos.</p>

          <button
            onClick={handleDisconnect}
            disabled={disconnect.isPending}
            className="w-full border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Estado: conectado */}
      {isConnected && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="font-semibold text-gray-900">WhatsApp conectado</span>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
                className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
              >
                {disconnect.isPending ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          </div>

          {/* Mensaje de prueba */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Probar envío
            </p>
            <p className="text-sm text-gray-500 mb-3">
              Envía un mensaje de prueba para verificar que WhatsApp funciona correctamente.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="Ej. 9991234567"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button
                onClick={handleTest}
                disabled={testLoading || !testPhone.trim()}
                className="bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-green-600 transition-colors whitespace-nowrap"
              >
                {testLoading ? 'Enviando…' : 'Enviar prueba'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Mensajes automáticos
            </p>
            <div className="space-y-3">
              {MESSAGE_PREVIEWS.map((msg) => (
                <div key={msg.label} className="flex items-start gap-3">
                  <span className="text-lg">{msg.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">{msg.label}</p>
                    <p className="text-sm text-gray-800">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
