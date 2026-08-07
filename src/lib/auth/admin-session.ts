import 'server-only';

import { cookies } from 'next/headers';

import { env, isProduction } from '@/config/env';
import { timingSafeEqual } from '@/lib/security/timing-safe-equal';
import { deriveAdminSessionToken } from '@/lib/security/session-token';

/**
 * Single shared password gating /admin — no user table, no roles.
 * Cookie holds a token derived from the password (see `session-token.ts`),
 * not the password itself: cheap to verify, fine for a single-operator
 * kitchen, and a leaked cookie doesn't hand over the literal password.
 */
const COOKIE_NAME = 'admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function createAdminSession(): Promise<void> {
  const store = await cookies();
  const token = await deriveAdminSessionToken(env.ADMIN_PASSWORD);
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  if (cookie === undefined) return false;
  const token = await deriveAdminSessionToken(env.ADMIN_PASSWORD);
  return timingSafeEqual(cookie, token);
}

export function verifyAdminPassword(password: string): boolean {
  return timingSafeEqual(password, env.ADMIN_PASSWORD);
}
