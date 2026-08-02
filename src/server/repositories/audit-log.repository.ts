import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

export const auditLogRepository = {
  async record(entry: {
    action: Prisma.AuditLogCreateInput['action'];
    entity: string;
    entityId?: string;
    summary?: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    actorId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        summary: entry.summary,
        before: entry.before,
        after: entry.after,
        actorId: entry.actorId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  },

  async findRecent(params: { entity?: string; actorId?: string; skip?: number; take?: number }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.entity ? { entity: params.entity } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  },
};
