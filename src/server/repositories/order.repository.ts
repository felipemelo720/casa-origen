import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

export const orderDetailInclude = {
  items: {
    include: { variants: true, extras: true },
    orderBy: { createdAt: 'asc' as const },
  },
  history: {
    orderBy: { createdAt: 'asc' as const },
  },
  commune: { select: { name: true, deliveryFee: true } },
  paymentMethod: { select: { name: true, code: true, requiresChange: true } },
  coupon: { select: { code: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export const orderRepository = {
  async create(data: Prisma.OrderCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.order.create({ data, include: orderDetailInclude });
  },

  async findById(id: string): Promise<OrderDetail | null> {
    return prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
  },

  async findByCode(code: string): Promise<OrderDetail | null> {
    return prisma.order.findUnique({ where: { code }, include: orderDetailInclude });
  },

  async appendHistory(
    data: Prisma.OrderStatusHistoryCreateInput,
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.orderStatusHistory.create({ data });
  },

  async incrementProductSoldCount(
    productId: string,
    quantity: number,
    tx: Prisma.TransactionClient,
  ) {
    return tx.product.update({
      where: { id: productId },
      data: { soldCount: { increment: quantity } },
    });
  },
};
