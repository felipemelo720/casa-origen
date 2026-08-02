import 'server-only';

import { z } from 'zod';

/**
 * Server-side environment contract.
 *
 * Parsed once at module load. A missing or malformed variable fails the
 * process immediately with an actionable message instead of surfacing as an
 * obscure runtime error deep inside a request.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid PostgreSQL connection string'),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url(),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),

  UPLOAD_DIR: z.string().default('./public/uploads'),
  MAX_UPLOAD_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@casaorigen.cl'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin123!Change'),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid server environment variables:\n${issues}`);
  }

  return parsed.data;
}

export const env: ServerEnv = parseServerEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
