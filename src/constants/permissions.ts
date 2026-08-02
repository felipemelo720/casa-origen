/**
 * Permission catalogue — the single source of truth for RBAC.
 *
 * Keys follow `resource:action`. The seed script mirrors this file into the
 * `permissions` table, so adding an entry here and re-seeding is the only step
 * needed to introduce a new capability.
 */

export const RESOURCES = [
  'dashboard',
  'order',
  'product',
  'category',
  'extra',
  'variant',
  'ingredient',
  'tag',
  'promotion',
  'coupon',
  'customer',
  'user',
  'role',
  'banner',
  'commune',
  'payment_method',
  'schedule',
  'setting',
  'analytics',
  'audit',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export type PermissionKey = `${Resource}:${Action}`;

/** Builds a typed permission key. */
export function permission(resource: Resource, action: Action): PermissionKey {
  return `${resource}:${action}`;
}

/** Every permission that can exist in the system. */
export const ALL_PERMISSIONS: PermissionKey[] = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => permission(resource, action)),
);

export const ROLE_SLUGS = {
  ADMIN: 'administrador',
  MANAGER: 'gerente',
  EMPLOYEE: 'empleado',
  COOK: 'cocinero',
  COURIER: 'repartidor',
  CUSTOMER: 'cliente',
} as const;

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];

function readOnly(...resources: Resource[]): PermissionKey[] {
  return resources.map((resource) => permission(resource, 'read'));
}

function fullAccess(...resources: Resource[]): PermissionKey[] {
  return resources.flatMap((resource) =>
    ACTIONS.map((action) => permission(resource, action)),
  );
}

/**
 * Default grants applied by the seed. Roles remain fully editable afterwards
 * from the admin panel; this is only the starting position.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleSlug, PermissionKey[]> = {
  [ROLE_SLUGS.ADMIN]: ALL_PERMISSIONS,

  [ROLE_SLUGS.MANAGER]: [
    ...fullAccess(
      'order',
      'product',
      'category',
      'extra',
      'variant',
      'ingredient',
      'tag',
      'promotion',
      'coupon',
      'customer',
      'banner',
      'commune',
      'payment_method',
      'schedule',
    ),
    ...readOnly('dashboard', 'analytics', 'user', 'setting', 'audit'),
    permission('setting', 'update'),
  ],

  [ROLE_SLUGS.EMPLOYEE]: [
    ...readOnly('dashboard', 'product', 'category', 'customer', 'commune', 'payment_method'),
    permission('order', 'read'),
    permission('order', 'create'),
    permission('order', 'update'),
    permission('customer', 'create'),
    permission('customer', 'update'),
    permission('product', 'update'),
  ],

  [ROLE_SLUGS.COOK]: [
    ...readOnly('dashboard', 'product', 'category', 'ingredient'),
    permission('order', 'read'),
    permission('order', 'update'),
    permission('product', 'update'),
  ],

  [ROLE_SLUGS.COURIER]: [
    permission('order', 'read'),
    permission('order', 'update'),
    permission('commune', 'read'),
  ],

  [ROLE_SLUGS.CUSTOMER]: [],
};

/** Roles allowed to reach `/admin`. */
export const STAFF_ROLE_SLUGS: readonly RoleSlug[] = [
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.MANAGER,
  ROLE_SLUGS.EMPLOYEE,
  ROLE_SLUGS.COOK,
  ROLE_SLUGS.COURIER,
];

export const ROLE_LABELS: Record<RoleSlug, string> = {
  [ROLE_SLUGS.ADMIN]: 'Administrador',
  [ROLE_SLUGS.MANAGER]: 'Gerente',
  [ROLE_SLUGS.EMPLOYEE]: 'Empleado',
  [ROLE_SLUGS.COOK]: 'Cocinero',
  [ROLE_SLUGS.COURIER]: 'Repartidor',
  [ROLE_SLUGS.CUSTOMER]: 'Cliente',
};

export const ROLE_LEVELS: Record<RoleSlug, number> = {
  [ROLE_SLUGS.ADMIN]: 100,
  [ROLE_SLUGS.MANAGER]: 80,
  [ROLE_SLUGS.EMPLOYEE]: 50,
  [ROLE_SLUGS.COOK]: 40,
  [ROLE_SLUGS.COURIER]: 30,
  [ROLE_SLUGS.CUSTOMER]: 10,
};
