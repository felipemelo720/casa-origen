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

- Postgres **nativo** en el CT, `127.0.0.1:5432`. Usuario y DB: `casaorigen`.
  No hay Docker instalado; el contenedor `co-pg` en 5435 quedó de una etapa
  anterior y ya no existe.
- **No hay `.env`.** Los secretos viven en `.env.production`, que Next lee por
  su cuenta y el CLI de Prisma **no**: `migrate deploy` y `db seed` necesitan
  `DATABASE_URL` explícito delante del comando.
- Dev server: 3000–3006 están ocupados por otros proyectos y por el propio
  Casa Origen en producción. Levantar dev con puerto explícito:
  `npm run dev -- -p 3010`. Sin `-p`, Next va probando hacia arriba y el
  puerto cambia de sesión en sesión.
- **Producción en esta misma máquina**: pm2, app `casaorigen`,
  `npm start -- -p 3006`, cwd `/var/www/casa-origen`. Es lo que se ve en
  `http://10.10.10.12:3006`. Un cambio en el código **no aparece** ahí hasta
  rebuild + restart.
- `psql` directo (no hay `sudo` en el CT, se corre como root):
  `su postgres -c "psql -d casaorigen -c '...'"`

## Comandos

```bash
npm run dev -- -p 3010
npx prisma studio
npx prisma migrate dev --name <nombre>
npx prisma db seed
npx tsc --noEmit && npm run lint && npm run build   # dev apagado

# Desplegar a producción (3006). Parar pm2 primero: el build sobrescribe
# .next/ bajo los pies de `next start` y deja chunks 404.
pm2 stop casaorigen && rm -rf .next && npm run build && pm2 start casaorigen
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
