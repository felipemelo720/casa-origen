import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { env, isProduction } from '@/config/env';

/**
 * Customer session cookie: `<customerId>.<expiresAt>.<hmac>`.
 *
 * Stateless on purpose — no session table. The signature is what makes the
 * payload trustworthy, and the expiry travels inside the signed payload so a
 * client that keeps the cookie past its date cannot extend it.
 *
 * Deliberately unlike `admin-session.ts`: that one compares against one shared
 * secret, this one has to identify *which* customer, so it signs an id instead
 * of hashing a password.
 *
 * Trade-off accepted: no server-side revocation. Changing `AUTH_SECRET`
 * invalidates every session at once, which is the whole panic button we need
 * for a pizzeria with no payment data stored.
 */
const COOKIE_NAME = 'customer_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(payload: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createCustomerSession(customerId: string): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1_000;
  const payload = `${customerId}.${expiresAt}`;
  const store = await cookies();

  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: isProduction,
    // `lax`, not `strict`: the WhatsApp hand-off sends the customer out of the
    // site and back, and `strict` would drop the cookie on that return trip.
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearCustomerSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Returns the signed-in customer's id, or null. Never throws. */
export async function getCustomerSessionId(): Promise<string | null> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  if (cookie === undefined) return null;

  const separator = cookie.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  const [customerId, rawExpiry] = payload.split('.');
  if (!customerId || !rawExpiry) return null;

  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  return customerId;
}
