# Casa Origen — plan de proyecto

Pedidos de pizza. Next.js 15 App Router + TypeScript + Prisma + PostgreSQL.
Sin login de clientes, sin RBAC. Producción: VPS Debian 12 + Docker + Nginx.

---

## Pivote arquitectónico (2026-08-02/03) — CÓDIGO LISTO, FALTA QA

Bajado de 26 páginas (e-commerce completo, RBAC, checkout+tracking propio)
a **2 páginas** (`/` y `/admin`), calcado de `~/arrozenwok.cl` pero
manteniendo Postgres como fuente de verdad. Checkpoint pre-pivote en git:
commit `b78a0f6`.

| Dimensión | Antes | Ahora |
|---|---|---|
| Páginas | 26 | `/` y `/admin` |
| Menú | DB + CRUD admin | DB, sin CRUD (solo toggle disponibilidad) |
| Pedido | Checkout propio + tracking por código | Guarda en DB + abre WhatsApp |
| Admin | RBAC, 20 rutas | 1 página, password único (cookie) |

### Hecho
- Schema: fuera `User/Session/Account/Role/Permission/AuditLog`. Nuevo:
  `RestaurantSettings.acceptingOrders/closedMessage/deliveryEnabled`. DB
  reseteada, migración `init` nueva.
- Auth: `src/lib/auth/admin-session.ts` (cookie `admin_session` vs
  `env.ADMIN_PASSWORD`). `action-builder.ts`: `publicAction` se mantiene,
  `authedAction`/`permissionAction` fuera. `middleware.ts` solo protege
  `/admin/*`. Borrados todos los archivos Better Auth.
- Admin colapsado a `src/app/(admin)/admin/page.tsx`: login, abrir/cerrar
  negocio, toggle delivery, disponibilidad por producto, stats 7 días.
  Acciones planas en `admin.actions.ts` (`assertAdmin()` manual, se usan
  como form actions nativas con `.bind()`). Borradas 18 subrutas admin +
  CRUD viejo (productos/categorías/extras/etiquetas/ingredientes/cocina/
  pedidos/configuración/estadísticas).
- Checkout: `placeOrderAction` sigue guardando en Postgres. Al confirmar,
  además abre `wa.me` con el detalle (`src/lib/whatsapp.ts`). Número sale
  de `RestaurantSettings.whatsapp`. Borrado `/pedido`, `/pedido/[code]`
  (tracking), `order-status.service.ts` (sin UI que lo use).
- Storefront colapsado a 1 página: `product-card.tsx` reescrito con
  selector de tamaño **inline** (sin página de detalle), `page.tsx` hero +
  grid de pizzas en `#menu`. Borrado `/menu`, `/menu/[category]`,
  `/producto/[slug]`. Header/footer apuntan a `#menu` en vez de rutas
  borradas. `sitemap.ts`/`robots.ts` simplificados a 1 URL.
- Limpieza de dead code: `category.repository.ts` borrado (sin caller),
  `product.repository.ts` recortado a lo usado (`findAllForMenu`,
  `findForPricing`, `findAllForAvailabilityToggle`, `setAvailability`),
  `order.repository.ts` sin `changedBy`/`courier`, `checkout.service.ts`
  sin param `context` muerto.
- `npx tsc --noEmit` y `npm run lint` limpios.
- `npx prisma db seed` corrido OK contra la DB reseteada: 1 categoría,
  7 productos, sin `seedAdmin`/roles/permisos.
- Dependencias muertas fuera: `better-auth` y `@node-rs/argon2` sacadas de
  `package.json`, `@node-rs/argon2` sacado de `serverExternalPackages` en
  `next.config.ts`, `npm install` corrido (26 paquetes removidos).
- `npm run build` limpio. Rutas finales: `/` (estática), `/admin`
  (dinámica), `/robots.txt`, `/sitemap.xml`, `/_not-found`.
- `deliveryEnabled` cableado de punta a punta: `placeOrder` rechaza
  `orderType: DELIVERY` con delivery apagado, `getCheckoutOptionsAction`
  expone el flag y `checkout-form` esconde la opción y cae a `PICKUP`
  (el carrito persiste `orderType` en localStorage, así que puede llegar
  con DELIVERY ya elegido). Antes el toggle del admin no hacía nada.
- Más dead code fuera: `catalog-support.repository.ts` completo (0
  callers), el re-export `timeToMinutes` de `schedule.service.ts` y la
  función en `lib/utils.ts` que quedó huérfana.
- `lib/utils.ts` recortado a lo que se usa (`cn`, `slugify`): fuera
  `clamp`, `stripUndefined`, `chunk` y `minutesToTime`, todos sin
  callers. `minutesToTime` estaba además duplicado por
  `minutesToLocalTime` en `schedule.service.ts`; sobrevive el local, que
  es su único consumidor y envuelve en 24h en vez de recortar.

### Secciones de venta en la landing (2026-08-03)
Tres bloques nuevos sobre el menú, que se mantiene igual:
- **Los más pedidos** — `productRepository.findTopSellers(4)` ordenado por
  `soldCount` (índice ya existía; lo incrementa `placeOrder`). Filtra
  `soldCount > 0`, así que la sección no aparece hasta que haya pedidos
  reales en vez de mostrar una lista arbitraria.
- **Cupón público** — `Coupon.isPublic` nuevo (migración
  `coupon_is_public`) + `couponRepository.findPublicActive()`, que valida
  vigencia y tope de usos. Sin ese campo la sección habría filtrado
  cupones privados. Solo `BIENVENIDA10` va marcado público;
  `ENVIOGRATIS` sigue canjeable en el checkout pero no se publica.
  `CouponBanner` copia el código y lo deja aplicado vía `setCoupon()`.
- **¿Llegamos a ti?** — `DeliveryChecker` con las 10 localidades de Paine
  (`Paine Centro`, `Huelquén`, `Champa`, `Hospital`, `Viluco`, `Chada`,
  `Valdivia de Paine`, `Águila Sur`, `Águila Norte`, `Angostura`).
  Muestra despacho, ETA y pedido mínimo antes de armar el carrito. Con
  `deliveryEnabled` apagado cae a "solo retiro en tienda".

Las comunas viejas de Santiago quedan `isActive: false`, no borradas:
pedidos históricos las referencian.

La landing ahora llama `getOpenState()`, el mismo check que aplica
`placeOrder`. Antes solo miraba `acceptingOrders` e ignoraba
`BusinessHour`, así que fuera de horario se veía normal y el cliente
descubría el rechazo recién en el checkout. El aviso sale en el hero y
repetido sobre el menú (quien entra por `#menu` no ve el hero), y el CTA
pasa a "Ver el menú igual". Con `revalidate = 60` el estado puede quedar
hasta un minuto desfasado.

### Falta
1. QA manual en navegador (lo hace Felipe): agregar pizza con tamaño →
   carrito → checkout → confirmar pedido en Postgres + WhatsApp se abre
   con mensaje correcto. Login admin con `ADMIN_PASSWORD`, togglear
   abierto/cerrado y disponibilidad, confirmar reflejo en la landing.

### Notas
- `npm audit` reporta 3 vulnerabilidades high, todas transitivas
  (`postcss`/`sharp` bajo `next`). No se tocan: el "fix" propuesto
  degrada `next` a 9.3.3.

---

## Infraestructura dev
Postgres Docker `co-pg`, puerto **5435** (5432-5434 ocupados por otros
proyectos). `npm run dev` / `build` / `npx prisma studio` funcionan.

## Decisiones fijas
- Dinero: enteros, nunca float/Decimal.
- Rate limit: in-memory fixed-window (migrar a Redis solo si multi-nodo).
- Precios siempre recalculados server-side (`pricing.service.ts`).
- Prisma solo desde repositorios (regla ESLint).
- Admin = password único compartido, no reintroducir RBAC sin necesidad
  real.
- Pedido = DB + WhatsApp (WhatsApp es aviso, no fuente de verdad).

## Comandos
```bash
npm run dev
npx prisma studio
npx prisma migrate dev --name <nombre>
npx prisma db seed
npx tsc --noEmit && npm run lint && npm run build
```
