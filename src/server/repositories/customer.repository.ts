import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

export const customerRepository = {
  async findByPhone(phone: string) {
    return prisma.customer.findUnique({ where: { phone }, include: { addresses: true } });
  },
  async findByUserId(userId: string) {
    return prisma.customer.findUnique({ where: { userId }, include: { addresses: true } });
  },
  async findById(id: string) {
    return prisma.customer.findUnique({ where: { id }, include: { addresses: true } });
  },
  async findAllForAdmin(params: { search?: string; skip?: number; take?: number }) {
    const where: Prisma.CustomerWhereInput = params.search
      ? {
          OR: [
            { firstName: { contains: params.search, mode: 'insensitive' } },
            { lastName: { contains: params.search, mode: 'insensitive' } },
            { phone: { contains: params.search } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { totalSpent: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 25,
      }),
      prisma.customer.count({ where }),
    ]);

    return { items, total };
  },
  async findFrequent(limit = 10) {
    return prisma.customer.findMany({
      where: { orderCount: { gt: 1 } },
      orderBy: { orderCount: 'desc' },
      take: limit,
    });
  },
  async create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data });
  },
  async update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.customer.delete({ where: { id } });
  },
  async upsertByPhone(phone: string, data: Prisma.CustomerCreateInput) {
    return prisma.customer.upsert({
      where: { phone },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      },
      create: data,
    });
  },
  async addAddress(data: Prisma.CustomerAddressCreateInput) {
    return prisma.customerAddress.create({ data });
  },
  /** Applied inside the order transaction after a successful checkout. */
  async recordOrder(id: string, orderTotal: number, tx: Prisma.TransactionClient = prisma) {
    return tx.customer.update({
      where: { id },
      data: { orderCount: { increment: 1 }, totalSpent: { increment: orderTotal } },
    });
  },
};
