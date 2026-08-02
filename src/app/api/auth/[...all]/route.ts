import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth/auth';

/** Better Auth mounts its whole REST surface under `/api/auth/*`. */
export const { GET, POST } = toNextJsHandler(auth.handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
