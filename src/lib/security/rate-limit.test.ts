import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/config/env', () => ({
  env: { RATE_LIMIT_MAX_REQUESTS: 3, RATE_LIMIT_WINDOW_MS: 60_000 },
}));

const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }));
vi.mock('next/headers', () => ({ headers: headersMock }));

import { consume, enforceRateLimit, getClientIp } from './rate-limit';
import { RateLimitError } from '@/lib/errors';

function fakeHeaders(entries: Record<string, string>) {
  return { get: (key: string) => entries[key] ?? null };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('consume', () => {
  it('allows the first request in a fresh window', () => {
    const result = consume(`id-${Math.random()}`, { scope: 'test', limit: 3, windowMs: 60_000 });
    expect(result).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
  });

  it('blocks once the limit is exceeded within the window', () => {
    const id = `id-${Math.random()}`;
    consume(id, { scope: 'test', limit: 2, windowMs: 60_000 });
    consume(id, { scope: 'test', limit: 2, windowMs: 60_000 });
    const third = consume(id, { scope: 'test', limit: 2, windowMs: 60_000 });
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps independent buckets per scope for the same identifier', () => {
    const id = `id-${Math.random()}`;
    consume(id, { scope: 'checkout', limit: 1, windowMs: 60_000 });
    const loginAttempt = consume(id, { scope: 'login', limit: 1, windowMs: 60_000 });
    expect(loginAttempt.allowed).toBe(true);
  });

  it('resets the window once it expires', async () => {
    vi.useFakeTimers();
    const id = `id-${Math.random()}`;
    consume(id, { scope: 'test', limit: 1, windowMs: 10 });
    vi.advanceTimersByTime(11);
    const afterReset = consume(id, { scope: 'test', limit: 1, windowMs: 10 });
    expect(afterReset.allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe('getClientIp', () => {
  it('prefers the first hop of x-forwarded-for', async () => {
    headersMock.mockResolvedValue(fakeHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }));
    expect(await getClientIp()).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when there is no x-forwarded-for', async () => {
    headersMock.mockResolvedValue(fakeHeaders({ 'x-real-ip': '9.9.9.9' }));
    expect(await getClientIp()).toBe('9.9.9.9');
  });

  it('falls back to "unknown" with no proxy headers at all', async () => {
    headersMock.mockResolvedValue(fakeHeaders({}));
    expect(await getClientIp()).toBe('unknown');
  });
});

describe('enforceRateLimit', () => {
  it('throws RateLimitError once the caller IP is exhausted', async () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 1000)}`;
    headersMock.mockResolvedValue(fakeHeaders({ 'x-real-ip': ip }));
    await enforceRateLimit({ scope: 'place-order', limit: 1, windowMs: 60_000 });
    await expect(
      enforceRateLimit({ scope: 'place-order', limit: 1, windowMs: 60_000 }),
    ).rejects.toThrow(RateLimitError);
  });
});
