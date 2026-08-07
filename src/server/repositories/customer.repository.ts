import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

/** Narrow projection for the signed-in customer — never the whole row. */
export type CustomerAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  orderCount: number;
  totalSpent: number;
};

const accountSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  orderCount: true,
  totalSpent: true,
} as const;

export const customerRepository = {
  async findByPhone(phone: string) {
    return prisma.customer.findUnique({ where: { phone }, include: { addresses: true } });
  },

  /** Login lookup. Includes `passwordHash`, so it never reaches a component. */
  async findAuthByEmail(email: string) {
    return prisma.customer.findUnique({
      where: { email },
      select: { ...accountSelect, passwordHash: true, isBlocked: true },
    });
  },

  async findAccountById(id: string): Promise<CustomerAccount | null> {
    return prisma.customer.findUnique({ where: { id }, select: accountSelect });
  },

  /**
   * Attaches credentials to the row the checkout already created for this
   * phone, or creates one. Registering after ordering as a guest has to adopt
   * the existing history instead of forking a second customer.
   */
  async upsertAccountByPhone(
    phone: string,
    data: { firstName: string; lastName: string; email: string; passwordHash: string },
  ): Promise<CustomerAccount> {
    return prisma.customer.upsert({
      where: { phone },
      update: data,
      create: { phone, ...data },
      select: accountSelect,
    });
  },

  /** Order history for the account page. Snapshot columns only. */
  async findOrdersByCustomer(customerId: string, limit = 20) {
    return prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        code: true,
        status: true,
        type: true,
        total: true,
        createdAt: true,
        items: { select: { name: true, quantity: true } },
      },
    });
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
