import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

export const userRepository = {
  async findAllForAdmin(params: { search?: string; skip?: number; take?: number }) {
    const where: Prisma.UserWhereInput = params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 25,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  },
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id }, include: { role: true } });
  },
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  },
  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },
  async setActive(id: string, isActive: boolean) {
    return prisma.user.update({ where: { id }, data: { isActive } });
  },
  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },
  async touchLastLogin(id: string) {
    return prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },
};

export const roleRepository = {
  async findAll() {
    return prisma.role.findMany({
      orderBy: { level: 'desc' },
      include: { _count: { select: { users: true } } },
    });
  },
  async findById(id: string) {
    return prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
  },
  async create(data: Prisma.RoleCreateInput) {
    return prisma.role.create({ data });
  },
  async update(id: string, data: Prisma.RoleUpdateInput) {
    return prisma.role.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.role.delete({ where: { id } });
  },
  async setPermissions(roleId: string, permissionIds: string[]) {
    return prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  },
};

export const permissionRepository = {
  async findAll() {
    return prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  },
};
