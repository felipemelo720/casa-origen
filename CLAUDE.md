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

- **Nunca `npm run dev` ni `npm run build` en `/var/www/casa-origen`.**
  Producción (`next start`) sirve desde ese mismo `.next/`; dev o build lo
  reescriben y la tienda queda con chunks 404 (`Runtime Error: [object Event]`,
  sin stack). Para probar: `git worktree` aparte (ver Infra dev).
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
- Probar cambios: `git worktree` aparte, `node_modules` enlazado, build +
  `next start -p 3010` con las variables de `.env.test` (base
  `casaorigen_test`). 3000–3006 están ocupados. Dev tampoco arranca en el
  repo: no hay `.env` y dev no lee `.env.production`.
- **Producción en esta misma máquina**: pm2, app `casaorigen`,
  `npm start -- -p 3006`, cwd `/var/www/casa-origen`
  (`http://10.10.10.12:3006`).
- **Deploy por timer** (`casaorigen-deploy.timer`, cada 5 min,
  `scripts/deploy.sh`): si `origin/main` avanzó y su CI está verde, pull
  `--ff-only`, build, restart, rollback a `.next.prev` si falla. Un commit
  local **sin push** o el tree sucio bloquean el deploy y disparan alerta
  (`histories diverged` / `working tree is dirty`).
- `psql` directo (no hay `sudo` en el CT, se corre como root):
  `su postgres -c "psql -d casaorigen -c '...'"`

## Comandos

```bash
npx prisma studio
npx prisma migrate dev --name <nombre>
npx prisma db seed
npx tsc --noEmit && npm run lint && npx vitest run   # build solo en worktree

# Desplegar: git push a main. El timer despliega tras el CI verde.
journalctl -u casaorigen-deploy.service -n 20   # estado del último intento
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
