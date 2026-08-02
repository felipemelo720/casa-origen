import 'server-only';

import type { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { orderRepository } from '@/server/repositories/order.repository';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';

/**
 * Legal transitions of the order lifecycle. Any pair not listed here is
 * rejected — the kitchen cannot skip from "Nuevo" straight to "Entregado".
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const TIMESTAMP_FIELD: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'confirmedAt',
  READY: 'readyAt',
  DELIVERED: 'deliveredAt',
  CANCELLED: 'cancelledAt',
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Statuses an order in `status` may legally move to next. */
export function nextStatuses(status: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

export async function changeOrderStatus(params: {
  orderId: string;
  toStatus: OrderStatus;
  changedById?: string;
  note?: string;
  cancellationReason?: string;
}) {
  const order = await orderRepository.findById(params.orderId);
  if (!order) throw new NotFoundError('El pedido');

  if (!canTransition(order.status, params.toStatus)) {
    throw new BusinessRuleError(
      `No es posible cambiar el pedido de "${order.status}" a "${params.toStatus}".`,
    );
  }

  const timestampField = TIMESTAMP_FIELD[params.toStatus];

  return prisma.$transaction(async (tx) => {
    const updated = await orderRepository.updateStatus(
      params.orderId,
      {
        status: params.toStatus,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
        ...(params.toStatus === 'CANCELLED' && params.cancellationReason
          ? { cancellationReason: params.cancellationReason }
          : {}),
      },
      tx,
    );

    await orderRepository.appendHistory(
      {
        order: { connect: { id: params.orderId } },
        fromStatus: order.status,
        toStatus: params.toStatus,
        note: params.note,
        ...(params.changedById ? { changedBy: { connect: { id: params.changedById } } } : {}),
      },
      tx,
    );

    return updated;
  });
}
