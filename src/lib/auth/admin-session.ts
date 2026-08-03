import 'server-only';

import { cookies } from 'next/headers';

import { env, isProduction } from '@/config/env';

/**
 * Single shared password gating /admin — no user table, no roles.
 * Cookie holds the password itself (not a token), matching the reference
 * project's model: cheap to verify, fine for a single-operator kitchen.
 */
const COOKIE_NAME = 'admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function createAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, env.ADMIN_PASSWORD, {
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
  return store.get(COOKIE_NAME)?.value === env.ADMIN_PASSWORD;
}

export function verifyAdminPassword(password: string): boolean {
  return password === env.ADMIN_PASSWORD;
}
