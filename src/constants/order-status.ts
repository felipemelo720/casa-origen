import type { OrderStatus } from '@prisma/client';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'Recibido',
  CONFIRMED: 'Confirmado',
  PREPARING: 'En preparación',
  READY: 'Listo',
  OUT_FOR_DELIVERY: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};
