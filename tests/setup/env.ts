import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Lee `.env.test` sin dependencias nuevas.
 *
 * El CLI de Prisma solo auto-carga `.env` (mismo gotcha que se pagó en el
 * deploy), así que el valor hay que pasárselo explícitamente al subproceso de
 * `migrate deploy`. Y `src/config/env.ts` parsea `process.env` al importarse,
 * antes de que corra cualquier `beforeAll`, así que las variables tienen que
 * estar puestas desde la config de vitest.
 */
export function loadTestEnv(): Record<string, string> {
  const path = resolve(process.cwd(), '.env.test');

  // En CI no existe el archivo: las variables ya vienen del workflow. Devolver
  // `{}` deja que gane `process.env` en vez de romper la corrida.
  if (!existsSync(path)) return {};

  const raw = readFileSync(path, 'utf8');
  const parsed: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    parsed[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return parsed;
}
