# Casa Origen — plan de proyecto

Sistema de restaurante full-stack. Next.js 15 App Router + TypeScript + Prisma
+ PostgreSQL + Better Auth. Objetivo: producción, VPS Debian 12 + Docker
Compose + Nginx. Cero MVP, cero demo.

Este archivo es el punto de retomo para cualquier sesión futura. Antes de
escribir código, leer "Estado actual" y "Siguiente paso inmediato".

---

## Estado actual (2026-08-02, actualizado — Fase 1 storefront + Fase 2b admin: productos y catálogos)

### Completado y verificado (`tsc --noEmit` limpio, `next build` limpio)

- **Config base**: `tsconfig.json` (strict), `next.config.ts` (standalone,
  headers de seguridad, imágenes AVIF/WebP), `eslint.config.mjs` (flat,
  prohíbe importar Prisma fuera de `src/server/repositories`), Prettier,
  `postcss.config.mjs`, Tailwind v4 vía `@theme inline` en `globals.css`.
- **Entorno**: `src/config/env.ts` (servidor, Zod) y `public-env.ts`
  (cliente, `NEXT_PUBLIC_*`). `.env.example` documentado. `.env` local
  apunta a Postgres en Docker puerto **5435** (contenedor `co-pg`).
- **Base de datos**: `prisma/schema.prisma` completo — 30 modelos, 10 enums,
  dinero en enteros (unidad mínima de moneda), índices en toda ruta caliente,
  soft snapshot de pedidos (order items no se rompen si se borra el
  producto). Migración `init` aplicada. `prisma/seed.ts` idempotente —
  permisos, roles, admin, config, comunas, tags, ingredientes, extras,
  catálogo demo (7 categorías / 14 productos), banners, promo, cupones.
  Admin sembrado: `admin@casaorigen.cl` / password en `SEED_ADMIN_PASSWORD`.
- **Core lib** (`src/lib/`): `db/prisma.ts` (singleton), `logger.ts` (Pino,
  redacción de secretos), `errors.ts` (jerarquía `AppError`), `result.ts`
  (`ActionResult<T>` para Server Actions), `money.ts`, `utils.ts`,
  `security/rate-limit.ts` (fixed-window in-memory, migrar a Redis si se
  escala a multi-nodo), `security/sanitize.ts`.
- **Auth + RBAC** (`src/lib/auth/`, `src/constants/permissions.ts`):
  Better Auth + adaptador Prisma + Argon2id custom (`@node-rs/argon2`,
  memoria 19 MiB / t=2). 6 roles del sistema (administrador, gerente,
  empleado, cocinero, repartidor, cliente), permisos `resource:action`.
  `src/lib/auth/session.ts` expone `requireUser/requirePermission/requireStaff`
  cacheados con `React.cache`. `src/middleware.ts` protege `/admin` y
  `/cuenta` a nivel de cookie (chequeo optimista; la autorización real ocurre
  en cada Server Action). Ruta API: `src/app/api/auth/[...all]/route.ts`.
- **UI kit**: shadcn/ui instalado (`new-york`, tema `stone` + tokens propios
  oklch en `globals.css`, dark mode). ~25 componentes en `src/components/ui`.
  Fuentes: Geist (paquete `geist`) + Playfair Display (`next/font/google`)
  para branding (`--font-display`). Providers: tema (`next-themes`),
  TanStack Query, `TooltipProvider`, `Toaster` (sonner) — todo en
  `src/components/providers/app-providers.tsx`.
- **Repositorios** (`src/server/repositories/`, capa única con acceso a
  Prisma — regla de ESLint lo fuerza): `category`, `product` (incluye
  `findForPricing` sin sobre-fetch, `duplicate`, paginación cursor),
  `catalog-support` (extras/tags/ingredientes/variantes), `operations`
  (comunas, métodos de pago, horarios, banners, `RestaurantSettings`
  singleton), `promotion` + `coupon`, `customer`, `identity` (user/role/
  permission), `audit-log`, `order` (incluye vista pública de tracking),
  `counter` (códigos secuenciales atómicos vía upsert+increment),
  `analytics` (agregaciones SQL crudas para series diarias, ventas por
  hora, top categorías — evita N+1 y trae el cálculo a la base de datos).
- **Servicios** (`src/server/services/`):
  - `pricing.service.ts` — motor de precios. **Nunca confía en precios que
    manda el cliente**: recalcula todo desde catálogo (variantes, extras,
    ingredientes removidos), valida disponibilidad, aplica la mejor
    promoción activa (por prioridad, scope ALL/CATEGORY/PRODUCT) y cupón,
    calcula despacho por comuna con reglas de envío gratis.
  - `checkout.service.ts` — `placeOrder`: transacción atómica completa
    (código secuencial, upsert de cliente por teléfono, creación de orden +
    items + variantes + extras, historial de estado, contador
    `soldCount` por producto, canje de cupón, totales de cliente).
  - `order-status.service.ts` — máquina de estados
    (`NEW→CONFIRMED→PREPARING→READY→OUT_FOR_DELIVERY→DELIVERED`,
    `CANCELLED` desde casi cualquier estado), transición atómica +
    historial.
  - `schedule.service.ts` — `getOpenState()`: combina el switch manual
    `acceptingOrders` de settings con `business_hours` semanal.
- **Server Actions** (`src/server/actions/`): `action-builder.ts` (wrapper
  que compone Zod, rate limit, permisos, logging y traducción de errores —
  `publicAction` / `authedAction` / `permissionAction`), `checkout.actions.ts`
  (`placeOrderAction`, `previewCartTotalsAction`), `order-tracking.actions.ts`
  (`trackOrderAction` público, `updateOrderStatusAction` con permiso
  `order:update`).
- **Schemas Zod** (`src/schemas/`): `cart.schema.ts`, `checkout.schema.ts`
  (con `superRefine` para dirección/comuna obligatoria si es delivery).
- **Storefront (completo, flujo de compra navegable de punta a punta)**:
  `src/app/(storefront)/layout.tsx` (header + footer + `CartDrawer` global),
  landing (`page.tsx` — hero con banner dinámico, categorías, destacados,
  más vendidos), `/menu` y `/menu/[category]` (`menu-view.tsx` compartido,
  buscador, `CategoryNav`). `ProductCard` con quick-add. `CartDrawer` (Sheet
  lateral, persistido vía Zustand + `persist` en `localStorage`, edición de
  cantidad, subtotal en vivo). `cart-store.ts` — estado global del carrito,
  `estimateLineTotal` cliente (solo para UI; el total real lo calcula
  `pricing.service.ts`), `toCartItemInput` mapea `CartLine` → payload de
  servidor.
  - `producto/[slug]/page.tsx` + `product-detail-view.tsx`: galería, grupos
    de variantes SINGLE/MULTIPLE con min/max, extras con stepper de
    cantidad, ingredientes removibles, observaciones (si `allowNotes`),
    "agregar al carrito" arma el `CartLine` completo.
  - `checkout/page.tsx` + `checkout-form.tsx` (React Hook Form + Zod):
    delivery/pickup, datos de contacto, dirección/comuna condicional,
    método de pago (`paymentMethodRepository.findAllActive`), flujo
    "paga con" + vuelto si es efectivo, cupón con totales en vivo
    (`previewCartTotalsAction` vía TanStack Query), submit →
    `placeOrderAction` → redirect a `/pedido/[code]`. La validación de
    comuna obligatoria en delivery ocurre aquí (Zod `superRefine`, cliente
    y servidor) — no hay guardia adicional en el drawer.
  - `pedido/page.tsx` (form código) + `pedido/[code]/page.tsx` +
    `order-tracking-view.tsx`: polling con TanStack Query
    (`refetchInterval` 5s, se detiene en `DELIVERED`), timeline de estados
    según `type` (delivery incluye `OUT_FOR_DELIVERY`, pickup no).
  - PWA: `public/manifest.webmanifest`, `public/sw.js` (cache-first para
    `/_next/static` e imágenes/fuentes, network-first para navegación),
    `ServiceWorkerRegister` (solo registra en producción),
    `src/app/sitemap.ts` (estáticas + categorías + hasta 200 productos),
    `src/app/robots.ts`. **Iconos son placeholder** (`public/icons/*.svg`,
    monograma "CO" plano) — reemplazar por assets de marca reales antes de
    producción.

- **Panel admin (operativo, parcial)**: `src/app/(admin)/admin/layout.tsx`
  (`requireStaff()` + sidebar `admin-sidebar.tsx` filtrada por permisos,
  `hasPermission`), rutas:
  - `/admin` — dashboard: ventas hoy, pedidos activos, ticket promedio
    (`stat-card.tsx` compartido), tabla de pedidos activos.
  - `/admin/pedidos` — listado con filtro por estado + búsqueda (código/
    nombre/teléfono), paginación, `OrderStatusSelect` (cambia estado
    respetando `nextStatuses()` de `order-status.service.ts`).
  - `/admin/cocina` — Kanban NEW/CONFIRMED/PREPARING
    (`orderRepository.findActiveForKitchen`), polling TanStack Query 8s vía
    `getActiveKitchenOrdersAction`, botón "avanzar" + cancelar por tarjeta.
  - `/admin/categorias` + `nuevo` + `[id]` — CRUD completo (schema, actions
    con `permissionAction`, slugify automático, selector de padre, borrado
    bloqueado si tiene productos/subcategorías).
  - `/admin/configuracion` — form completo sobre `RestaurantSettings`
    singleton (general, contacto, operación/delivery, SEO). No incluye
    subida de logo/favicon/imagen SEO (sin pipeline de upload todavía).
  - `/admin/estadisticas` — Recharts: línea de ventas diarias, barras de
    pedidos por hora, donut de top categorías, tabla de clientes
    frecuentes. Selector de rango 7/30/90 días.
  - **Bug real encontrado y corregido**: `analytics.repository.ts` usaba
    columnas SQL en snake_case (`placed_at`, `order_id`, `line_total`,
    etc.) en las queries `$queryRaw`, pero el schema no tiene `@map` en
    esos campos — las columnas reales son camelCase. Sin este fix
    `/admin/estadisticas` tiraba 500. Verificado insertando un pedido de
    prueba directo en Postgres y confirmando render correcto en pedidos,
    cocina, dashboard y tracking público antes de borrarlo.
  - `/admin/productos` + `nuevo` + `[id]` — CRUD completo, el más grande:
    info básica (precio/oferta con validación oferta&lt;precio, categoría,
    disponibilidad, prep, switches activo/visible/destacado/observaciones),
    imágenes (URLs, sin upload todavía), etiquetas y extras (toggle +
    `priceOverride`/`maxQuantity`), ingredientes (toggle + removible),
    grupos de variantes anidados (`variant-group-row.tsx`,
    `useFieldArray` anidado con sub-componente `OptionRow` por regla de
    hooks — no se puede llamar `useController` en un loop con conteo
    variable). Update reemplaza todas las relaciones anidadas dentro de
    una transacción (`productRepository.updateWithRelations`) — más
    simple y igual de correcto que diffear filas para un form que siempre
    manda el estado completo. `product.actions.ts`
    (`create/update/delete/duplicate`).
  - `/admin/extras`, `/admin/etiquetas`, `/admin/ingredientes` — CRUD
    simple de los catálogos compartidos (`catalog-support.actions.ts`,
    `extra-form.tsx`/`tag-form.tsx`/`ingredient-form.tsx`). Borrado
    bloqueado si el catálogo está en uso por algún producto (constraint
    de FK capturada como `BusinessRuleError`/`ConflictError`).
  - Componentes reusados entre CRUDs: `form-field.tsx` (wrapper
    label+error), `delete-entity-button.tsx` (confirm + acción genérica,
    reemplazó el `delete-category-button.tsx` original), `slugify` movido
    a `lib/utils.ts` (antes duplicado en cada form).
  - **Fuera de esta fase** (documentado en Pendiente por tarea → 10):
    variantes standalone (viven anidadas en producto, no aplica CRUD
    propio), promociones, cupones, clientes, usuarios, horarios, comunas,
    métodos de pago, banners, roles y permisos. Impresión de
    comanda/ticket. Subida de imágenes (logo/favicon/SEO, galería de
    productos).
  - **No probado con navegador real**: creación/edición de un producto
    con variantes/extras vía la UI (el flujo de escritura de Server
    Actions no se puede simular fácilmente con curl). Sí se verificó con
    `tsc`/`build` limpios y render correcto de `/admin/productos` y
    `/admin/productos/[id]` con un producto real de la seed (incluye sus
    variantes/extras/tags/ingredientes). Recomendado smoke test manual
    antes de producción.

### Infraestructura dev

- Postgres corriendo en Docker: contenedor `co-pg`, puerto **5435**,
  db `casaorigen`, user `casaorigen` / pass `dev_local_pw` (ver `.env`).
- **Ojo**: puertos 5433/5434 ocupados por otros proyectos (`qrflow-postgres`
  y otro). No asumir que 5432 está libre — revisar `docker ps` antes de
  levantar nada.
- `npm run dev`, `npm run build`, `npx prisma studio` funcionan.

---

## Siguiente paso inmediato

**Tarea 7 completa** (storefront). **Tareas 9/11 completas**, **tarea 10
avanzada** (dashboard, pedidos, cocina, productos, categorías, extras,
etiquetas, ingredientes, configuración — falta el resto, ver abajo).
`tsc --noEmit`, `npm run lint` y `npm run build` limpios en cada pasada.
Smoke test manual con sesión real de `admin@casaorigen.cl`: todas las
rutas admin devuelven 200 y renderizan datos reales de la seed
(`/admin/productos/[id]` con un producto con variantes/extras reales
incluido).

Ahora sigue terminar **tarea 10** (panel admin) — falta:

1. Promociones y cupones (`promotion.repository.ts`/`coupon.repository.ts`
   ya existen) — scope ALL/CATEGORY/PRODUCT, prioridad, límites de uso.
2. Clientes (solo lectura + edición básica, `customer.repository.ts`).
3. Usuarios + roles + permisos (`identity.repository.ts`) — el más
   sensible: asignar permisos por rol, activar/desactivar usuarios. Cuidado
   de no permitir que un admin se quite su propio acceso.
4. Horarios (`business_hours`), comunas (costos de despacho), métodos de
   pago, banners — todos catálogos simples, mismo patrón que
   extras/etiquetas/ingredientes (`form-field.tsx` +
   `delete-entity-button.tsx` ya reusables).
5. Impresión de comanda/ticket desde `/admin/pedidos`.
6. Subida de imágenes (logo/favicon/SEO de `RestaurantSettings`, galería
   de productos) — no hay pipeline de upload todavía (Vercel Blob ya está
   en `next.config.ts remotePatterns`, falta el endpoint/acción de
   subida). Hoy los forms de producto/categoría/config piden URL directa.

Pendientes menores que quedaron de fases anteriores (bajo impacto,
revisar antes de producción):
- Iconos PWA son placeholder — cambiar por marca real.
- Editar variantes/extras/notas de una línea **desde el drawer** sin
  borrar y re-agregar (hoy: se arman solo al agregar desde
  `producto/[slug]`; para cambiar hay que quitar la línea y re-agregarla).
- Verificar `next.config.ts` `images.remotePatterns` si se agregan hosts
  de imágenes nuevos.
- No se probó la creación/edición de datos vía navegador real en ningún
  CRUD (checkout, productos, categorías, etc.) — los Server Actions no se
  pueden simular fácilmente con curl (requieren el protocolo Flight de
  Next). Verificado con `tsc`/`lint`/`build` limpios + render correcto de
  cada página con datos reales de la seed (y, para pedidos, con un pedido
  de prueba insertado directo en Postgres). Recomendado un smoke test
  manual completo en navegador antes de producción.

---

## Pendiente por tarea

### 8 — Cart drawer + checkout
- [x] Store Zustand persistido, drawer, edición de cantidad.
- [x] Checkout form completo (`checkout-form.tsx`).
- [ ] Edición de variantes/extras/notas **desde el drawer** (hoy solo se
  arman al agregar; falta poder editarlos sin borrar y re-agregar).
- [x] Validar `orderType`/`communeId` antes de crear el pedido — hecho vía
  Zod `superRefine` en `checkout-form.tsx` (cliente) + `checkout.schema.ts`
  (servidor, autoritativo). No hay guardia extra en el drawer.

### 9 — Pedidos: ciclo de vida, tiempo real, tracking
- [x] Máquina de estados (`order-status.service.ts`).
- [x] `updateOrderStatusAction` con permisos.
- [x] UI de tracking público (`pedido/[code]/page.tsx` +
  `order-tracking-view.tsx`, polling TanStack Query 5s, se detiene en
  `DELIVERED`).
- [x] Vista de cocina/kitchen (`orderRepository.findActiveForKitchen`) para
  rol Cocinero — Kanban NEW/CONFIRMED/PREPARING, polling 8s
  (`/admin/cocina`, `kitchen-board.tsx`).
- [x] Tiempo real (storefront + cocina admin): polling TanStack Query
  `refetchInterval`. SSE/WebSocket sigue siendo mejora posterior si se
  necesita push real — no usar WebSocket a menos que se justifique (más
  complejidad de despliegue con Nginx).

### 10 — Panel admin: CRUDs (parcial)
`src/app/(admin)/admin/layout.tsx` con `requireStaff()` + sidebar por
permisos ya construido (`admin-sidebar.tsx`). Patrón establecido:
`page.tsx` (tabla server-rendered con `<Table>` de shadcn), `[id]/page.tsx`
(form edición), `nuevo/page.tsx` (form creación), `src/server/actions/*.ts`
con `permissionAction`, `src/schemas/*.schema.ts` por entidad.

- [x] Dashboard (`/admin`): ventas hoy, pedidos activos, ticket promedio.
- [x] Pedidos: listado + filtros + cambio de estado (`/admin/pedidos`).
  Falta impresión de comanda/ticket.
- [x] Cocina: Kanban (`/admin/cocina`).
- [x] Categorías: CRUD completo (`/admin/categorias`).
- [x] Configuración: form `RestaurantSettings` (`/admin/configuracion`,
  sin subida de logo/favicon/imagen SEO — no hay pipeline de upload).
- [x] Productos (`/admin/productos`): variantes/extras/imágenes/tags/
  ingredientes anidados, el más grande. Update vía
  `productRepository.updateWithRelations` (reemplaza todas las
  relaciones en una transacción en vez de diffear filas).
- [x] Extras, etiquetas, ingredientes: CRUD simple (`/admin/extras`,
  `/admin/etiquetas`, `/admin/ingredientes`).
- [ ] Resto de CRUDs: promociones, cupones, clientes, usuarios, roles,
  permisos, horarios, comunas/costos de despacho, métodos de pago,
  banners.
- [ ] Impresión de comanda/ticket desde `/admin/pedidos`.
- [ ] Subida de imágenes (logo/favicon/SEO, galería de productos) — hoy
  todos los forms piden URL directa, sin pipeline de upload.

### 11 — Estadísticas + gráficos
- [x] Página `/admin/estadisticas` con Recharts: línea de serie diaria,
  barras de pedidos por hora, donut de top categorías, tabla de top
  clientes. Selector de rango 7/30/90 días.
- [x] Corregido bug real en `analytics.repository.ts` (columnas SQL
  snake_case vs. columnas reales camelCase) descubierto al probar esta
  página contra Postgres — sin el fix, `dailySeries`/`ordersByHour`/
  `topCategories` tiraban 500.

### 12 — DevOps
Nada construido. Falta desde cero:
- [ ] `Dockerfile` multi-stage (`deps` → `builder` → `runner`, usar
  `output: 'standalone'` ya configurado en `next.config.ts`).
- [ ] `docker-compose.yml`: servicios `app`, `postgres` (con healthcheck
  `pg_isready`), `nginx`. Volúmenes para `public/uploads` y backups de
  Postgres. Red interna dedicada.
- [ ] `docker/nginx/nginx.conf` — reverse proxy, gzip, headers de
  seguridad (redundante con `next.config.ts` pero defensa en profundidad),
  rate limiting a nivel Nginx para `/api/auth/*`, config TLS (Let's
  Encrypt vía certbot — documentar proceso, no automatizar renovación
  dentro del compose salvo que se pida).
- [ ] `scripts/deploy.sh`, `scripts/backup.sh` (pg_dump programable),
  `scripts/restore.sh`.
- [ ] Healthcheck endpoint: `src/app/api/health/route.ts` (chequea conexión
  a DB).
- [ ] Documentar variables de entorno de producción en `.env.example`
  (ya existe, revisar que esté completo cuando se escriba el compose).

### 13 — Verificación final
- [ ] `npx tsc --noEmit` limpio (última corrida: limpio, repetir tras cada
  módulo grande).
- [ ] `npm run lint` limpio.
- [ ] `npm run build` limpio (última corrida exitosa, solo con landing +
  menú; repetir con todo el admin agregado).
- [ ] Probar seed desde cero (`prisma migrate reset --force` en un entorno
  descartable) para confirmar idempotencia total.
- [ ] Smoke test manual: flujo completo comprador (menú → producto →
  carrito → checkout → tracking) y flujo admin (login → cambiar estado de
  un pedido → ver en estadísticas).

---

## Decisiones técnicas ya tomadas (no revisitar sin razón fuerte)

- **Dinero**: enteros en unidad mínima de moneda (CLP = sin decimales).
  Nunca usar `float`/`Decimal` de JS para montos.
- **Rate limiting**: in-memory fixed-window, por proceso. Correcto para
  VPS de un solo nodo (caso de uso del enunciado). Si se despliega
  multi-instancia, migrar a Redis — el call-site (`enforceRateLimit`) no
  cambia.
- **Autorización en dos capas**: middleware (cookie presente, optimista) +
  `requirePermission` en cada Server Action (autoritativo). Nunca confiar
  solo en el middleware.
- **Precios siempre recalculados server-side** en `pricing.service.ts`. El
  cliente solo manda *selecciones* (ids), nunca precios.
- **Prisma solo desde repositorios** — regla de ESLint activa. Si un
  archivo en `app/` o `features/` necesita datos nuevos, agregar un método
  al repositorio correspondiente, no importar `prisma` directo.
- **Server Actions siempre devuelven `ActionResult<T>`** (`ok`/`fail`), no
  lanzan al cliente — usar `action-builder.ts`, no escribir actions sueltas.
- **No usar `cacheComponents`/`use cache`** todavía (Next 15.5 estable, la
  feature es experimental/Next 16). Cache actual: `export const revalidate`
  por página + `revalidateTag` manual tras escrituras. Revisar si se migra
  cuando el proyecto suba a Next 16.
- **Postgres en 5435 en este entorno dev** — puertos 5432-5434 ocupados por
  otros proyectos del usuario. En producción (Docker Compose) usar 5432
  interno sin conflicto (red aislada).

---

## Comandos útiles

```bash
# Dev
npm run dev

# DB
npx prisma studio
npx prisma migrate dev --name <nombre>
npx prisma db seed

# Verificación
npx tsc --noEmit
npm run lint
npm run build

# Postgres dev (si el contenedor co-pg no existe)
docker run -d --name co-pg -e POSTGRES_USER=casaorigen \
  -e POSTGRES_PASSWORD=dev_local_pw -e POSTGRES_DB=casaorigen \
  -p 5435:5432 postgres:16-alpine
```
