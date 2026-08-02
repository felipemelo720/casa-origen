import 'server-only';

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { env, isProduction } from '@/config/env';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

/**
 * Better Auth server instance.
 *
 * Password hashing is delegated to Argon2id instead of the library default,
 * and the session is refreshed at most once a day to avoid a write on every
 * request while still extending active sessions.
 */
export const auth = betterAuth({
  appName: 'Casa Origen',
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },

  user: {
    modelName: 'user',
    additionalFields: {
      phone: { type: 'string', required: false, input: true },
      roleId: { type: 'string', required: false, input: false },
      isActive: { type: 'boolean', required: false, input: false, defaultValue: true },
      lastLoginAt: { type: 'date', required: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  advanced: {
    cookiePrefix: 'casa-origen',
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },

  trustedOrigins: [env.BETTER_AUTH_URL],

  // Must stay last: it flushes Set-Cookie headers from Server Actions.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
