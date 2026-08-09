import { execFileSync } from 'node:child_process';

import { loadTestEnv } from './env';

/**
 * Corre una sola vez por invocación de vitest: deja el schema al día y el
 * catálogo sembrado.
 *
 * Se re-siembra siempre en vez de "solo si hace falta": el seed es idempotente
 * (upserts) y tarda segundos, y la alternativa —adivinar si el catálogo está
 * al día— es exactamente el tipo de estado implícito que hace que un test
 * falle en la máquina de otro.
 */
export default function setup(): void {
  const env = { ...process.env, ...loadTestEnv() };
  const run = (args: string[]) => execFileSync('npx', args, { env, stdio: 'inherit' });

  run(['prisma', 'migrate', 'deploy']);
  run(['prisma', 'db', 'seed']);
}
