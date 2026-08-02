import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { ForbiddenError, UnauthenticatedError } from '@/lib/errors';
import {
  STAFF_ROLE_SLUGS,
  type PermissionKey,
  type RoleSlug,
} from '@/constants/permissions';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  phone: string | null;
  isActive: boolean;
  roleSlug: RoleSlug | null;
  roleName: string | null;
  roleLevel: number;
  permissions: ReadonlySet<PermissionKey>;
};

/**
 * Resolves the current user together with the flattened permission set.
 *
 * Wrapped in `React.cache`, so a request that checks permissions in a layout,
 * a page and three components still performs exactly one database round-trip.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      isActive: true,
      role: {
        select: {
          slug: true,
          name: true,
          level: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  // A user disabled mid-session must lose access immediately.
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    phone: user.phone,
    isActive: user.isActive,
    roleSlug: (user.role?.slug as RoleSlug | undefined) ?? null,
    roleName: user.role?.name ?? null,
    roleLevel: user.role?.level ?? 0,
    permissions: new Set(
      (user.role?.permissions ?? []).map(
        (entry) => entry.permission.key as PermissionKey,
      ),
    ),
  };
});

export function hasPermission(
  user: SessionUser | null,
  ...required: PermissionKey[]
): boolean {
  if (!user) return false;
  return required.every((key) => user.permissions.has(key));
}

export function hasAnyPermission(
  user: SessionUser | null,
  ...candidates: PermissionKey[]
): boolean {
  if (!user) return false;
  return candidates.some((key) => user.permissions.has(key));
}

export function isStaff(user: SessionUser | null): boolean {
  return user?.roleSlug ? STAFF_ROLE_SLUGS.includes(user.roleSlug) : false;
}

/** Throws unless a session exists. Use at the top of protected work. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/** Throws unless the session holds every listed permission. */
export async function requirePermission(
  ...required: PermissionKey[]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, ...required)) {
    throw new ForbiddenError(
      `Requiere el permiso: ${required.join(', ')}.`,
    );
  }
  return user;
}

/** Throws unless the session belongs to a staff role. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user)) throw new ForbiddenError();
  return user;
}
