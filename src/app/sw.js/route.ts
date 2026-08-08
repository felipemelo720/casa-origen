import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// El service worker se sirve desde acá y no desde `public/` por una sola razón:
// necesita saber en qué build está. Con `CACHE_NAME` fijo (era
// `'casa-origen-v1'`, hardcodeado) la caché cache-first de imágenes no se
// invalidaba nunca: el `activate` borra las claves distintas de `CACHE_NAME`,
// así que si el nombre no cambia, no hay nada que borrar. Cambiar una foto del
// menú desde el admin no llegaba jamás a un visitante que ya había entrado.
//
// El `BUILD_ID` cambia en cada `next build`, que es exactamente la granularidad
// que queremos: un deploy invalida la caché, un restart sin rebuild no.
const buildId = (() => {
  try {
    return readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim();
  } catch {
    // Sin BUILD_ID legible caemos al arranque del proceso. Peor granularidad
    // (cada restart invalida), pero nunca un nombre constante: fail closed
    // hacia "invalidar de más", no hacia "servir una foto vieja para siempre".
    return `boot-${Date.now()}`;
  }
})();

const source = `const CACHE_NAME = 'casa-origen-${buildId}';
const STATIC_PATTERNS = [/\\/_next\\/static\\//, /\\/icons\\//, /\\.(?:png|jpg|jpeg|svg|webp|avif|woff2?)$/];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = STATIC_PATTERNS.some((pattern) => pattern.test(url.pathname));

  if (isStatic) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))));
  }
});
`;

export function GET() {
  return new Response(source, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // El browser tiene que ver el script nuevo para disparar el update del
      // worker. Cachearlo sería volver al bug por otra puerta.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
