import { z } from 'zod';

/**
 * Client-safe environment contract.
 *
 * Next.js inlines `NEXT_PUBLIC_*` at build time, so every key must be
 * referenced statically — destructuring `process.env` would break the
 * replacement.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Casa Origen'),
  NEXT_PUBLIC_CURRENCY: z.string().length(3).default('CLP'),
  NEXT_PUBLIC_LOCALE: z.string().min(2).default('es-CL'),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_CURRENCY: process.env.NEXT_PUBLIC_CURRENCY,
  NEXT_PUBLIC_LOCALE: process.env.NEXT_PUBLIC_LOCALE,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')} — ${issue.message}`)
      .join('; ')}`,
  );
}

export const publicEnv = parsed.data;
