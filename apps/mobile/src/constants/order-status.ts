export type OrderStatus =
  | 'NEW' | 'UNDER_REVIEW' | 'CONFIRMED' | 'IN_PREPARATION' | 'READY'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'REJECTED' | 'FINISHED' | 'WAITING_CONFIRMATION';

export const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  NEW:                  { label: 'Nuevo',        color: '#3B82F6' },
  UNDER_REVIEW:         { label: 'En revisión',  color: '#EAB308' },
  CONFIRMED:            { label: 'Confirmado',   color: '#22C55E' },
  IN_PREPARATION:       { label: 'Preparando',   color: '#FF6B35' },
  READY:                { label: 'Listo',         color: '#8B5CF6' },
  OUT_FOR_DELIVERY:     { label: 'En camino',    color: '#8B5CF6' },
  DELIVERED:            { label: 'Entregado',    color: '#6B7280' },
  CANCELLED:            { label: 'Cancelado',    color: '#EF4444' },
  REJECTED:             { label: 'Rechazado',    color: '#EF4444' },
  FINISHED:             { label: 'Finalizado',   color: '#6B7280' },
  WAITING_CONFIRMATION: { label: 'Esperando',    color: '#9CA3AF' },
};

// Transición principal (avanzar flujo)
export const NEXT_TRANSITION: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  NEW:            { status: 'CONFIRMED',      label: 'Confirmar pedido' },
  CONFIRMED:      { status: 'IN_PREPARATION', label: 'Iniciar preparación' },
  IN_PREPARATION: { status: 'READY',          label: 'Marcar como listo' },
  READY:            { status: 'OUT_FOR_DELIVERY', label: 'Salió a entregar' },
  OUT_FOR_DELIVERY: { status: 'DELIVERED',        label: 'Marcar entregado' },
};

// Transición de cancelación/rechazo
export const CANCEL_TRANSITION: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  NEW:            { status: 'REJECTED',  label: 'Rechazar' },
  CONFIRMED:      { status: 'CANCELLED', label: 'Cancelar' },
  IN_PREPARATION: { status: 'CANCELLED', label: 'Cancelar' },
};
