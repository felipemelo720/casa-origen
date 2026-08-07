import { NextResponse, type NextRequest } from 'next/server';

import { timingSafeEqual } from '@/lib/security/timing-safe-equal';
import { deriveAdminSessionToken } from '@/lib/security/session-token';

/**
 * Edge-side route gate for /admin.
 *
 * Optimistic check only: it confirms the admin cookie matches the derived
 * session token, which is cheap and needs no database access. There is no
 * per-user session — the cookie holds a token derived from the shared
 * password (see `src/lib/auth/admin-session.ts` / `session-token.ts`).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin') return NextResponse.next();

  if (pathname.startsWith('/admin')) {
    const cookie = request.cookies.get('admin_session')?.value;
    const adminPassword = process.env.ADMIN_PASSWORD ?? '';
    const expectedToken = await deriveAdminSessionToken(adminPassword);
    const isAuthenticated = Boolean(cookie) && timingSafeEqual(cookie ?? '', expectedToken);

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
