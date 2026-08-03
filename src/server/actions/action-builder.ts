import 'server-only';

import type { z } from 'zod';

import { createLogger } from '@/lib/logger';
import { failFrom, ok, type ActionResult } from '@/lib/result';
import { ValidationError } from '@/lib/errors';
import { ForbiddenError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { isAdminAuthenticated } from '@/lib/auth/admin-session';

const log = createLogger('action');

export type ActionContext = Record<string, never>;

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
  return run(options, schema, async () => ({}) as ActionContext, handler);
}

/** Requires the admin cookie (single shared password). */
export function adminAction<TInput, TOutput>(
  options: BaseOptions,
  schema: z.ZodType<TInput>,
  handler: (input: TInput, context: ActionContext) => Promise<TOutput>,
) {
  return run(
    options,
    schema,
    async () => {
      if (!(await isAdminAuthenticated())) throw new ForbiddenError();
      return {} as ActionContext;
    },
    handler,
  );
}
