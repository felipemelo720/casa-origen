import { beforeEach, vi } from 'vitest';

// Los `vi.mock` de un `setupFile` valen para todos los archivos de test, así
// que la frontera con Next se declara una sola vez.

vi.mock('next/headers', async () => {
  // El factory se hoistea sobre los imports del archivo: la referencia al
  // store tiene que resolverse acá adentro.
  const { cookieStore, headerStore } = await import('./request-context');
  return {
    cookies: async () => cookieStore,
    headers: async () => headerStore,
  };
});

// `revalidatePath`/`revalidateTag` tiran fuera de un request de Next. Que se
// llamen o no es cosa del cache de Next, no de la regla de negocio que el test
// mira; se anulan.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
}));

beforeEach(async () => {
  const { resetRequestContext } = await import('./request-context');
  resetRequestContext();
});
