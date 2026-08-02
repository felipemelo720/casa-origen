import 'server-only';

import type { z } from 'zod';

import { createLogger } from '@/lib/logger';
import { failFrom, ok, type ActionResult } from '@/lib/result';
import { ValidationError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { requirePermission, requireUser, type SessionUser } from '@/lib/auth/session';
import type { PermissionKey } from '@/constants/permissions';

const log = createLogger('action');

export type ActionContext = {
  user: SessionUser | null;
};

export type AuthenticatedActionContext = {
  user: SessionUser;
};

type BaseOptions = {
  /** Used for logging and as the rate-limit bucket name. */
  name: string;
  rateLimit?: { limit: number; windowMs?: number };
};

/**
 * Composes validation, rate limiting, authorisation, logging and error
 * translation around a Server Action body.
 *
 * The handler receives already-parsed input and a guaranteed context, so it
 * only ever contains business logic — no boilerplate, no duplicated guards.
 */
function run<TInput, TOutput, TContext>(
  options: BaseOptions,
  schema: z.ZodType<TInput>,
  resolveContext: () => Promise<TContext>,
  handler: (input: TInput, context: TContext) => Promise<TOutput>,
) {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    const startedAt = performance.now();

    try {
      if (options.rateLimit) {
        await enforceRateLimit({
          scope: options.name,
          limit: options.rateLimit.limit,
          windowMs: options.rateLimit.windowMs,
        });
      }

      const parsed = schema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(
          'Revisa los campos marcados.',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }

      const context = await resolveContext();
      const data = await handler(parsed.data, context);

      log.info(
        { action: options.name, ms: Math.round(performance.now() - startedAt) },
        'action succeeded',
      );

      return ok(data);
    } catch (error) {
      log.error(
        {
          action: options.name,
          ms: Math.round(performance.now() - startedAt),
          err: error instanceof Error ? error.message : String(error),
        },
        'action failed',
      );
      return failFrom(error);
    }
  };
}

/** Public action: no session required. */
export function publicAction<TInput, TOutput>(
  options: BaseOptions,
  schema: z.ZodType<TInput>,
  handler: (input: TInput, context: ActionContext) => Promise<TOutput>,
) {
  return run(options, schema, async () => ({ user: null }) as ActionContext, handler);
}

/** Requires an authenticated, active user. */
export function authedAction<TInput, TOutput>(
  options: BaseOptions,
  schema: z.ZodType<TInput>,
  handler: (input: TInput, context: AuthenticatedActionContext) => Promise<TOutput>,
) {
  return run(options, schema, async () => ({ user: await requireUser() }), handler);
}

/** Requires an authenticated user holding every listed permission. */
export function permissionAction<TInput, TOutput>(
  options: BaseOptions & { permissions: PermissionKey[] },
  schema: z.ZodType<TInput>,
  handler: (input: TInput, context: AuthenticatedActionContext) => Promise<TOutput>,
) {
  return run(
    options,
    schema,
    async () => ({ user: await requirePermission(...options.permissions) }),
    handler,
  );
}
