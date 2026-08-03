import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge-side route gate for /admin.
 *
 * Optimistic check only: it confirms the admin cookie value matches, which
 * is cheap and needs no database access. There is no per-user session — the
 * cookie holds the shared password itself (see `src/lib/auth/admin-session.ts`).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin') return NextResponse.next();

  if (pathname.startsWith('/admin')) {
    const cookie = request.cookies.get('admin_session')?.value;
    const isAuthenticated = Boolean(cookie) && cookie === process.env.ADMIN_PASSWORD;

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
