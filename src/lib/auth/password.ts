import 'server-only';

import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id parameters.
 *
 * Tuned to OWASP's 2024 baseline (19 MiB, t=2, p=1), which resists GPU
 * cracking while staying under ~50 ms on a modest VPS core.
 *
 * `algorithm: 2` is Argon2id — `@node-rs/argon2`'s `Algorithm` is a
 * TypeScript `const enum`, which `isolatedModules` (required by Next.js'
 * SWC-based transpilation) cannot import, so the resolved numeric value is
 * used directly instead.
 */
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  digest: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(digest, password, ARGON2_OPTIONS);
  } catch {
    // A malformed or truncated digest must read as "wrong password", never
    // as a server error that could leak account existence.
    return false;
  }
}
