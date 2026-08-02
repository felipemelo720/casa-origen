import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { OrderStatus, Prisma } from '@prisma/client';

export const orderDetailInclude = {
  items: {
    include: { variants: true, extras: true },
    orderBy: { createdAt: 'asc' as const },
  },
  history: {
    include: { changedBy: { select: { name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  commune: { select: { name: true, deliveryFee: true } },
  paymentMethod: { select: { name: true, code: true, requiresChange: true } },
  coupon: { select: { code: true } },
  courier: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

const listSelect = {
  id: true,
  code: true,
  status: true,
  type: true,
  paymentStatus: true,
  firstName: true,
  lastName: true,
  phone: true,
  total: true,
  placedAt: true,
  estimatedMinutes: true,
  courierId: true,
  paymentMethod: { select: { name: true, code: true } },
  commune: { select: { name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

export type OrderListItem = Prisma.OrderGetPayload<{ select: typeof listSelect }>;

export type OrderListFilter = {
  status?: OrderStatus[];
  search?: string;
  courierId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip?: number;
  take?: number;
};

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

  /** Powers the customer-facing tracking page: only public-safe fields. */
  async findTrackingByCode(code: string) {
    return prisma.order.findUnique({
      where: { code },
      select: {
        code: true,
        status: true,
        type: true,
        placedAt: true,
        confirmedAt: true,
        readyAt: true,
        deliveredAt: true,
        estimatedMinutes: true,
        total: true,
        firstName: true,
        history: {
          select: { toStatus: true, createdAt: true, note: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async findMany(filter: OrderListFilter): Promise<{ items: OrderListItem[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(filter.status?.length ? { status: { in: filter.status } } : {}),
      ...(filter.courierId ? { courierId: filter.courierId } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? {
            placedAt: {
              ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: 'insensitive' } },
              { phone: { contains: filter.search } },
              { firstName: { contains: filter.search, mode: 'insensitive' } },
              { lastName: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: listSelect,
        orderBy: { placedAt: 'desc' },
        skip: filter.skip ?? 0,
        take: filter.take ?? 25,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total };
  },

  async findActiveForKitchen() {
    return prisma.order.findMany({
      where: { status: { in: ['NEW', 'CONFIRMED', 'PREPARING'] } },
      include: orderDetailInclude,
      orderBy: { placedAt: 'asc' },
    });
  },

  async updateStatus(
    id: string,
    data: Prisma.OrderUpdateInput,
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.order.update({ where: { id }, data, include: orderDetailInclude });
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
