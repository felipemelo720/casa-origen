'use client';

import { createAuthClient } from 'better-auth/react';

import { publicEnv } from '@/config/public-env';

/** Browser-side Better Auth client. */
export const authClient = createAuthClient({
  baseURL: publicEnv.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
