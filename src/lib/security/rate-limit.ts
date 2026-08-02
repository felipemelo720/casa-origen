import 'server-only';

import { headers } from 'next/headers';

import { env } from '@/config/env';
import { RateLimitError } from '@/lib/errors';

/**
 * Fixed-window rate limiter backed by an in-process map.
 *
 * A single Next.js container owns its own window, which is the correct
 * trade-off for a single-node VPS deployment: no network hop, no extra
 * service. Scaling horizontally means swapping this module's `consume`
 * implementation for a Redis-backed one — every caller stays unchanged.
 */
type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Drops expired buckets so the map cannot grow without bound. */
function evictExpired(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitOptions = {
  /** Distinguishes independent limits (e.g. `login`, `checkout`). */
  scope: string;
  limit?: number;
  windowMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function consume(
  identifier: string,
  { scope, limit = env.RATE_LIMIT_MAX_REQUESTS, windowMs = env.RATE_LIMIT_WINDOW_MS }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  evictExpired(now);

  const key = `${scope}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Best-effort client IP, honouring the reverse proxy headers set by Nginx. */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    const [first] = forwarded.split(',');
    if (first) return first.trim();
  }
  return headerList.get('x-real-ip') ?? 'unknown';
}

/** Consumes a slot for the calling request, throwing when exhausted. */
export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const ip = await getClientIp();
  const result = consume(ip, options);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
}
