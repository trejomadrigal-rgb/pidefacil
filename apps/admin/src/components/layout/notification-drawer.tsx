'use client';

import { ClipboardList } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/use-notifications';
import type { AdminNotification } from '@/api/notifications';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const notifications: AdminNotification[] = data?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px]">
        <SheetHeader className="flex flex-row items-center justify-between pr-8">
          <SheetTitle>Notificaciones</SheetTitle>
          {notifications.some((n) => !n.isRead) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Marcar todas leídas
            </Button>
          )}
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
          {notifications.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Sin notificaciones
            </p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-lg p-3 ${
                !n.isRead ? 'bg-orange-50 border border-orange-100' : 'bg-background'
              }`}
            >
              <ClipboardList className="h-5 w-5 mt-0.5 text-[#FF6B35] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs h-7"
                  onClick={() => markRead.mutate(n.id)}
                  disabled={markRead.isPending}
                >
                  Leída
                </Button>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
