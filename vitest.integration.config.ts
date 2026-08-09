import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { loadTestEnv } from './tests/setup/env';

/**
 * Tests de integración: capas reales contra Postgres real.
 *
 * Van aparte de `vitest.config.ts` a propósito. Los unit corren en
 * milisegundos y no piden nada; estos necesitan Docker levantado y una base
 * migrada, así que meterlos en la misma corrida haría que `npm run test` deje
 * de servir como chequeo instantáneo.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': fileURLToPath(new URL('./tests/setup/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.itest.ts'],
    env: loadTestEnv(),
    globalSetup: ['./tests/setup/global-setup.ts'],
    setupFiles: ['./tests/setup/setup-integration.ts'],
    // Una sola base compartida: dos archivos truncando en paralelo se pisan.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
