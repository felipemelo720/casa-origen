import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Edge-side route gate.
 *
 * This is an *optimistic* check: it only asks whether a session cookie is
 * present, which is cheap and requires no database access. Authorisation
 * proper (role, permissions, active flag) is enforced again in every layout
 * and Server Action through `requirePermission`.
 */
const PROTECTED_PREFIXES = ['/admin', '/cuenta'] as const;
const AUTH_ROUTES = ['/ingresar', '/registro'] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: 'casa-origen',
  });
  const isAuthenticated = Boolean(sessionCookie);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/ingresar', request.url);
    loginUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals, the auth API (which manages its own
     * cookies) and static assets.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|uploads/|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|txt|xml)$).*)',
  ],
};
