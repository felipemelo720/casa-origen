import 'server-only';

import { prisma } from '@/lib/db/prisma';

/**
 * Reporting queries.
 *
 * Every method uses `groupBy`/`aggregate` so the database does the
 * summarisation — the application never pulls raw order rows into memory to
 * compute a total.
 */
export const analyticsRepository = {
  async salesBetween(from: Date, to: Date) {
    const result = await prisma.order.aggregate({
      where: { placedAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    });

    return {
      revenue: result._sum.total ?? 0,
      orderCount: result._count,
      averageTicket: Math.round(result._avg.total ?? 0),
    };
  },

  async dailySeries(from: Date, to: Date) {
    return prisma.$queryRaw<{ day: Date; revenue: bigint; orders: bigint }[]>`
      SELECT
        date_trunc('day', "placedAt") AS day,
        COALESCE(SUM("total"), 0) AS revenue,
        COUNT(*) AS orders
      FROM "orders"
      WHERE "placedAt" BETWEEN ${from} AND ${to}
        AND "status" != 'CANCELLED'
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  },

  async ordersByHour(from: Date, to: Date) {
    return prisma.$queryRaw<{ hour: number; orders: bigint }[]>`
      SELECT
        EXTRACT(HOUR FROM "placedAt")::int AS hour,
        COUNT(*) AS orders
      FROM "orders"
      WHERE "placedAt" BETWEEN ${from} AND ${to}
        AND "status" != 'CANCELLED'
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  },

  async topProducts(from: Date, to: Date, limit = 10) {
    return prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: { order: { placedAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });
  },

  async topCategories(from: Date, to: Date, limit = 10) {
    return prisma.$queryRaw<{ category: string; revenue: bigint; units: bigint }[]>`
      SELECT
        c."name" AS category,
        COALESCE(SUM(oi."lineTotal"), 0) AS revenue,
        COALESCE(SUM(oi."quantity"), 0) AS units
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      JOIN "products" p ON p."id" = oi."productId"
      JOIN "categories" c ON c."id" = p."categoryId"
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."status" != 'CANCELLED'
      GROUP BY c."name"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;
  },

  async statusBreakdown(from: Date, to: Date) {
    return prisma.order.groupBy({
      by: ['status'],
      where: { placedAt: { gte: from, lte: to } },
      _count: true,
    });
  },

  async topCustomers(limit = 10) {
    return prisma.customer.findMany({
      orderBy: { totalSpent: 'desc' },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        orderCount: true,
        totalSpent: true,
      },
    });
  },
};
