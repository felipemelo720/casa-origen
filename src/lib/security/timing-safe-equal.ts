/**
 * Constant-time string comparison.
 *
 * `a === b` returns as soon as the first differing character is found, so
 * the response time leaks how many leading characters an attacker guessed
 * right — a classic timing side-channel against a password check. This
 * walks the full length every time regardless of where (or whether) the
 * strings diverge.
 *
 * No `node:crypto` dependency on purpose: `middleware.ts` runs at the edge,
 * where `crypto.timingSafeEqual` isn't guaranteed to be available.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  const length = Math.max(bufA.length, bufB.length);

  // Fold the length mismatch into the result instead of short-circuiting,
  // so a different-length guess doesn't finish faster than a same-length one.
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < length; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }

  return diff === 0;
}
