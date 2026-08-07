# Casa Origen

dame outputs y respuestas de menos de 300 caracteres.

Pedidos de pizza. Next.js 15 App Router + TypeScript + Prisma + Postgres.
Tres páginas: `/` (landing + carrito + checkout), `/cuenta` y `/admin`.
Plan y estado detallado en `PLAN.md`.

Las secciones de la landing viven en `src/features/storefront/` y son
server components. El home ensambla el orden en
`src/app/(storefront)/page.tsx`, con un solo `Promise.all` para todas las
consultas.

El rol de diseño y arquitectura (principios, sistema de diseño, contrato de
capas, definition of done, rúbrica de revisión) se carga solo con este
archivo, vía import:

@docs/AI-ROLE.md

## Respuestas

Menos de 500 caracteres. Sin preámbulo, sin resumen final.
Código, comandos y errores exactos, verbatim.

## Reglas duras

- **Nunca `npm run build` con `npm run dev` levantado.** El build sobrescribe
  `.next/` y deja al dev sirviendo chunks 404 como `text/plain`. En el browser
  eso aparece como `Runtime Error: [object Event]`, sin stack. Si pasa:
  `rm -rf .next` y reiniciar dev.
- Dinero: enteros, nunca float ni Decimal.
- Precios siempre recalculados server-side en `pricing.service.ts`. El cliente
  manda selecciones (ids + cantidades), nunca precios.
- Prisma solo desde `src/server/repositories/` (regla ESLint).
- Admin = password único compartido (`ADMIN_PASSWORD` + cookie). No
  reintroducir RBAC sin necesidad real.
- Cliente = email + password, cookie `customer_session` firmada con
  `AUTH_SECRET` (nunca con `ADMIN_PASSWORD`). El guest checkout se mantiene:
  la cuenta nunca puede ser requisito para pedir.
- Pedido = fila en Postgres + link a WhatsApp. WhatsApp es aviso, no fuente
  de verdad.
- Toda validación de negocio se repite server-side. Esconder algo en la UI
  no es validarlo.

## Infra dev

- Postgres en Docker, contenedor `co-pg`, puerto **5435** (5432-5434 los usan
  otros proyectos). Usuario y DB: `casaorigen`.
- Dev server: puerto 3000 lo ocupa otro proyecto, Next cae a **3001**.
- `psql` directo: `docker exec co-pg psql -U casaorigen -d casaorigen -c "..."`

## Comandos

```bash
npm run dev
npx prisma studio
npx prisma migrate dev --name <nombre>
npx prisma db seed
npx tsc --noEmit && npm run lint && npm run build   # dev apagado
```

## Gotchas

- `tsx` no puede importar módulos con `import 'server-only'` (todos los
  repositorios y servicios). Para consultar la DB en un script, ir por `psql`.
- Migrar el schema con el dev server encendido deja al Prisma Client viejo en
  memoria: `Unknown argument 'X'` hasta reiniciar dev.
- Los upserts del seed deben repetir en `update` todo campo que se quiera
  poder corregir sin resetear la DB.
- `noUncheckedIndexedAccess` está activo: indexar un array da `T | undefined`.
- Las fotos de productos viven en `public/menu/*.jpg`, no en Unsplash. Los
  banners todavía apuntan afuera y se caen sin aviso: un 404 de imagen produce
  `[object Event]`.
- Depurar errores de cliente: Chromium headless con CDP
  (`chromium --headless=new --remote-debugging-port=9333`) y leer
  `Runtime.consoleAPICalled` / `Network.loadingFailed`. El overlay de Next
  esconde el detalle.
