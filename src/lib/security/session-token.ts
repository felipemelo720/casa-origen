/**
 * Derives the admin session cookie value from ADMIN_PASSWORD.
 *
 * The cookie used to hold the password itself. If it ever leaked — XSS,
 * an access log, a browser-profile backup — the leak handed over the
 * literal admin password. This derives a one-way SHA-256 token instead:
 * useless outside this app, and doesn't expose the password even though
 * the check is still effectively "does this match the one shared secret".
 *
 * Uses Web Crypto (`crypto.subtle`) instead of `node:crypto` so the exact
 * same code runs in `middleware.ts`, which executes at the edge.
 */
const PEPPER = 'casa-origen:admin-session:v1';

let cache: { password: string; token: string } | null = null;

export async function deriveAdminSessionToken(password: string): Promise<string> {
  if (cache && cache.password === password) return cache.token;

  const data = new TextEncoder().encode(`${PEPPER}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const token = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  cache = { password, token };
  return token;
}
