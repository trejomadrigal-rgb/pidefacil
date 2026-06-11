'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { toast, Toaster } from 'sonner';
import { getQueryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth.store';
import { connectSocket, disconnectSocket } from '@/lib/socket';

interface NewOrderEvent {
  notificationId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: number;
}

function SocketProvider() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;
    const s = connectSocket(accessToken);

    const handler = (data: NewOrderEvent) => {
      toast(`📋 Nuevo pedido #${data.orderNumber}`, {
        description: `${data.customerName} · $${data.total}`,
        duration: 8000,
        action: {
          label: 'Ver pedido',
          onClick: () => router.push(`/pedidos/${data.orderId}`),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    s.on('new_order', handler);
    return () => {
      s.off('new_order', handler);
      disconnectSocket();
    };
  }, [accessToken, router, queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider />
      <Toaster position="top-right" richColors />
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
