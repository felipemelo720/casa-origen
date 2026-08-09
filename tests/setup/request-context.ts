/**
 * Contexto de request falso, compartido por todos los tests de integración.
 *
 * `next/headers` solo funciona dentro de un request de Next. Las actions lo
 * usan para dos cosas reales — la cookie de admin (`admin-session.ts`) y la IP
 * del rate limit (`rate-limit.ts`) — así que en vez de mockear cada action se
 * mockea el módulo una sola vez (`setup-integration.ts`) contra estos stores.
 */
const cookieValues = new Map<string, string>();
const headerValues = new Map<string, string>();

export const cookieStore = {
  get(name: string): { name: string; value: string } | undefined {
    const value = cookieValues.get(name);
    return value === undefined ? undefined : { name, value };
  },
  getAll(): { name: string; value: string }[] {
    return [...cookieValues].map(([name, value]) => ({ name, value }));
  },
  has(name: string): boolean {
    return cookieValues.has(name);
  },
  // Las opciones (`httpOnly`, `sameSite`, `maxAge`) se ignoran a propósito:
  // acá no hay navegador que las haga cumplir, y lo que el test verifica es la
  // autorización, no la política de la cookie.
  set(name: string, value: string): void {
    cookieValues.set(name, value);
  },
  delete(name: string): void {
    cookieValues.delete(name);
  },
};

export const headerStore = {
  get(name: string): string | null {
    return headerValues.get(name.toLowerCase()) ?? null;
  },
  has(name: string): boolean {
    return headerValues.has(name.toLowerCase());
  },
};

/** Deja el contexto como una visita anónima recién llegada. */
export function resetRequestContext(): void {
  cookieValues.clear();
  headerValues.clear();
  // Sin IP, el rate limit mete a todos los tests en el bucket `unknown` y el
  // octavo pedido del archivo empieza a fallar por un motivo que no es el que
  // se está probando.
  headerValues.set('x-forwarded-for', '127.0.0.1');
}

export function setCookie(name: string, value: string): void {
  cookieValues.set(name, value);
}
