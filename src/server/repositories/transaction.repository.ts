import 'server-only';

import { prisma, type Prisma } from '@/lib/db/prisma';

/**
 * Runs `fn` inside a single Prisma transaction and returns its result.
 *
 * This is the only place outside a repository allowed to reach for
 * `prisma.$transaction`: services that need several repository calls to
 * commit or roll back together (order placement, coupon redemption, …) get
 * the `tx` handle through this wrapper instead of importing the Prisma
 * client directly, which would break the repository-only layer contract.
 */
export function withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
