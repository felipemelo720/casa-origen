'use server';

import { z } from 'zod';

import { publicAction, permissionAction } from '@/server/actions/action-builder';
import { orderRepository } from '@/server/repositories/order.repository';
import { changeOrderStatus } from '@/server/services/order-status.service';
import { NotFoundError } from '@/lib/errors';
import { permission } from '@/constants/permissions';

export const trackOrderAction = publicAction(
  { name: 'order.track', rateLimit: { limit: 30, windowMs: 60_000 } },
  z.object({ code: z.string().trim().min(3).max(40) }),
  async ({ code }) => {
    const order = await orderRepository.findTrackingByCode(code.toUpperCase());
    if (!order) throw new NotFoundError('El pedido');
    return order;
  },
);

export const updateOrderStatusAction = permissionAction(
  { name: 'order.updateStatus', permissions: [permission('order', 'update')] },
  z.object({
    orderId: z.string().min(1),
    toStatus: z.enum([
      'NEW',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ]),
    note: z.string().max(300).optional(),
    cancellationReason: z.string().max(300).optional(),
  }),
  async (input, { user }) => {
    const order = await changeOrderStatus({
      orderId: input.orderId,
      toStatus: input.toStatus,
      changedById: user.id,
      note: input.note,
      cancellationReason: input.cancellationReason,
    });
    return { id: order.id, status: order.status };
  },
);
