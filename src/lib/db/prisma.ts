import 'server-only';

import { PrismaClient } from '@prisma/client';

import { env, isProduction } from '@/config/env';

/**
 * Prisma singleton.
 *
 * Next.js clears the module registry on every HMR cycle, which would otherwise
 * open a new connection pool per edit and exhaust PostgreSQL in development.
 * Caching on `globalThis` keeps exactly one pool alive per process.
 */
const createPrismaClient = () =>
  new PrismaClient({
    log: isProduction
      ? ['error']
      : env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: isProduction ? 'minimal' : 'pretty',
  });

type PrismaSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaSingleton | undefined;
};

export const prisma: PrismaSingleton = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from '@prisma/client';
