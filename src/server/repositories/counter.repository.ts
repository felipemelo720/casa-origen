import 'server-only';

import type { Prisma } from '@prisma/client';

/**
 * Atomic counters backing human-readable codes (order numbers).
 *
 * `upsert` + `increment` is race-safe under PostgreSQL's row-level locking:
 * two concurrent checkouts serialise on the same row instead of reading the
 * same value twice.
 */
export const counterRepository = {
  async next(key: string, tx: Prisma.TransactionClient): Promise<number> {
    const counter = await tx.counter.upsert({
      where: { key },
      update: { value: { increment: 1 } },
      create: { key, value: 1 },
      select: { value: true },
    });
    return counter.value;
  },
};
