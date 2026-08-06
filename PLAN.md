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

### Home más profesional (2026-08-03)
Orden final de la landing: hero → trust bar → cupón → más pedidos →
`DeliveryChecker` → menú → cómo pedir → horarios.

- **`DeliveryChecker` movido sobre `#menu`.** Estaba al final, así que el
  cliente armaba el carrito y recién después descubría si le llegaba,
  cuánto costaba el despacho y cuál era el mínimo.
- **Trust bar** (`features/storefront/trust-bar.tsx`) bajo el hero:
  `deliveryEtaMinutes`, `pickupEtaMinutes`, `freeDeliveryFrom` y
  `minOrderAmount`. Todo eso ya estaba en settings pero solo aparecía en
  el checkout. Los ítems se arman condicionalmente: con `deliveryEnabled`
  apagado se caen despacho y envío gratis y quedan dos.
- **Cómo pedir** (`how-to-order.tsx`), tres pasos. Existe porque confirmar
  el carrito abre WhatsApp, y sin avisarlo antes el cambio de pestaña se
  lee como un bug justo en el último click. Recibe `whatsappEnabled`: sin
  `settings.whatsapp` el paso 3 dice "te llamamos" en vez de prometer un
  WhatsApp que nunca se abre.
- **Horarios** (`opening-hours.tsx`) + badge abierto/cerrado, alimentados
  por `getWeeklySchedule()` nuevo en `schedule.service.ts`. Devuelve los 7
  días con `HH:mm` ya formateado, `isToday`, y la semana partiendo en
  lunes (`WEEK_ORDER`), no en domingo como `getDay`. Un día que falte en
  `business_hours` sale como cerrado en vez de desaparecer, así la lista
  siempre tiene 7 filas. Los minutos crudos no salen del server.
- **JSON-LD `Restaurant`** (`restaurant-jsonld.tsx`): nombre, teléfono,
  dirección, redes, `hasMenu` y `openingHoursSpecification` (filtra los
  días cerrados, schema.org los infiere por ausencia). Reemplaza
  todo `<` por su escape unicode JSON antes de inyectar el string, para que
  un `</script>` metido en `description` o `address` desde el admin no pueda
  cerrar el tag. `seoImage` por fin se usa, con
  fallback a la imagen del banner del hero.

`tsc --noEmit`, `lint` y `build` limpios (con el dev apagado y `.next`
borrado antes). `/` sigue estática con `revalidate = 60`, 41.6 kB / 259 kB
First Load JS. Las cuatro secciones nuevas son server components y no
suman JS al cliente: el único componente cliente del home sigue siendo
`DeliveryChecker`.

Con `revalidate = 60` el badge "Abierto ahora" puede ir hasta un minuto
desfasado, igual que el aviso de cerrado del hero.

### Destacados editables desde el admin (2026-08-04)
«Los más pedidos» ya no es solo automático. `Product.isFeatured` (columna
que existía sin usar) se togglea con una estrella por producto en la lista
del admin. `productRepository.findHighlighted(HIGHLIGHTED_LIMIT)` devuelve
los destacados por `sortOrder` y, si no hay ninguno, cae al ranking viejo
por `soldCount`, así que sin curar nada el comportamiento es el de antes.
El admin avisa cuántos hay destacados y cuándo se pasa de
`HIGHLIGHTED_LIMIT` (4), porque la portada corta ahí en silencio.

La fila del admin pasó de ser un `<form>` a un `div` con dos forms
adentro: anidar forms es HTML inválido.

### Badge abierto/cerrado en el header (2026-08-04)
`(storefront)/layout.tsx` llama `getOpenState()` junto al `settings.get()`
que ya hacía y le pasa el `OpenState` a `StorefrontHeader`. El badge sale
al lado del nombre, verde «Abierto» / ámbar «Cerrado», con `title` que
lleva el motivo y la hora de reapertura. El header sigue siendo client
component, pero el estado se calcula en el server: `OpenState` es
serializable, no cruza nada de Prisma.

Mismo `getOpenState` que aplica `placeOrder`, así el badge no puede decir
«Abierto» mientras el checkout rechaza.

El badge además se refresca solo: `GET /api/open-state` (primer route
handler del proyecto, `dynamic = 'force-dynamic'` + `Cache-Control:
no-store`) devuelve el `OpenState` y el header lo pide cada 15s, más al
volver a la pestaña (`visibilitychange` / `focus`). El render del server
sigue siendo el estado inicial, así que no hay parpadeo ni hidratación
rara. Si el fetch falla se queda con el último estado conocido en vez de
mentir. Sin esto el toggle del admin tardaba hasta un minuto
(`revalidate = 60`) en verse en una pestaña ya abierta.

Se descartó SSE: obliga a `proxy_buffering off` en Nginx y a una conexión
viva por visitante, para ganar ~10s en una pizzería de un operador.

Medido con Chromium headless + CDP sobre la página real: cerrar desde el
admin se vio en ~9s, reabrir en ~15s. El resto de la landing (aviso del
hero, aviso sobre el menú) sigue atado a `revalidate = 60`; solo el badge
es en vivo.

### El switch del admin manda sobre el horario (2026-08-04)
`getOpenState` era un AND entre `acceptingOrders` y `business_hours`, así
que darle a «Abrir negocio» fuera de horario no hacía nada visible: el
badge seguía en «Cerrado» y el checkout seguía rechazando. Se leía como
un bug del polling y no lo era.

Ahora `getOpenState` mira solo `acceptingOrders`. `business_hours` pasa a
ser lo que la tienda publica (`getWeeklySchedule` y el JSON-LD), no una
segunda reja. Consecuencia asumida: **nada cierra solo**. Si nadie apreta
«Cerrar negocio», la web queda abierta a las 4am. El admin lo dice en la
tarjeta de estado.

`OpenState.reopensAt` se fue con la lógica horaria — solo lo poblaba la
rama «Aún no abrimos». Con eso salieron los `Abrimos a las HH:mm` del
hero, del aviso del menú y del `title` del badge.

Verificado a las 00:56, fuera del horario 12:00–23:00: el endpoint
devuelve `{"isOpen":true}` con el switch abierto, y en el browser el badge
siguió el toggle en ~10s / ~15s.

### Rol de diseño/arquitectura para IA (2026-08-05)
`docs/AI-ROLE.md`: rol definitivo (identidad, principios priorizados, contrato
del sistema de diseño sobre los tokens de `globals.css`, capas
page → action → service → repository, protocolo por tarea, definition of done,
prohibiciones, rúbrica de revisión). `CLAUDE.md` lo importa con
`@docs/AI-ROLE.md`, así que se carga en toda sesión sin pedirlo.
`.claude/agents/design-architect.md` expone el mismo rol como subagente.

El rol no repite infra, comandos ni gotchas: eso queda en `CLAUDE.md`, que se
carga junto. Un solo archivo por tema para que no se desincronicen.

### Carta real cargada (2026-08-05)
El seed traía siete pizzas inventadas a precios inventados. Entró la carta que
se vende de verdad: Pepperoni, Napolitana, Tres Carnes, Mechada, Cherry
Margarita, Rústica y La Huerta, en **dos** tamaños (24 y 32 cm), no tres.

| Pizza | 24 cm | 32 cm |
|---|---:|---:|
| Pepperoni | 5.500 | 10.000 |
| Napolitana | 6.000 | 10.000 |
| Tres Carnes | 6.500 | 11.000 |
| Mechada | 7.500 | 12.500 |
| Cherry Margarita 🌿 | 5.500 | 10.000 |
| Rústica | 6.000 | 10.000 |
| La Huerta 🌿 | 6.000 | 10.500 |

- **`PIZZA_SIZE_VARIANT` pasó a ser `pizzaSizes(deltaTo32)`.** Era una constante
  compartida con el mismo delta para todas. La carta cobra cada par por su
  cuenta: el salto a 32 cm es 4.000, 4.500 o 5.000 según la pizza. El schema ya
  lo aguantaba (`variant_groups` cuelga del producto); solo era dato.
- **Fotos bajadas a `public/menu/*.jpg`.** Prohibición dura de `AI-ROLE.md` §9 y
  gotcha ya pagado: una imagen de terceros que se cae produce
  `Runtime Error: [object Event]` sin stack. Los banners siguen apuntando a
  Unsplash — quedan como deuda, no se tocaron acá.
- **El bloque `update` del upsert de producto ahora repite nombre,
  descripciones, precio y `prepMinutes`.** Pepperoni y Napolitana sobreviven el
  cambio de carta por slug: sin esos campos en `update` se quedaban con la copy
  y el precio viejos hasta resetear la DB. `isFeatured` queda **fuera** a
  propósito: lo cura el admin con la estrella y un re-seed no debe pisarlo.
- **Tags e ingredientes se borran antes de re-linkear.** `createMany` solo
  agrega, nunca saca: Napolitana se quedaba marcada `Vegetariano` después de
  ganar jamón pierna. 🌿 queda solo en Cherry Margarita y La Huerta.
- **Las cinco pizzas viejas quedan `isActive: false`**, no borradas, mismo
  criterio que las comunas de Santiago: `order_items` las referencia. Hoy la
  tabla está en cero, pero la regla no depende de eso.
- Destacados iniciales: Pepperoni, Tres Carnes, Mechada y Cherry Margarita
  (cuatro = `HIGHLIGHTED_LIMIT`).

### Cobertura recortada y sin pedido mínimo (2026-08-05)
Las zonas de reparto bajaron de diez a cinco: `Paine Centro`, `Viluco (hasta el
retén)`, `Huelquén (hasta el retén)`, `Champa` y `Hospital`. Chada, Valdivia de
Paine, Águila Sur, Águila Norte y Angostura quedan `isActive: false`, mismo
criterio de siempre.

- **El `slug` de la comuna pasó a ir fijo en el seed**, ya no derivado de
  `name`. Renombrar `Viluco` a `Viluco (hasta el retén)` con el slug derivado
  habría creado una fila nueva y jubilado la vieja, partiendo la zona en dos.
  `name` entró además al bloque `update`, que no lo tenía.
- **No hay pedido mínimo.** `minOrder` es 0 en las cinco comunas y
  `minOrderAmount` es 0 en settings. Se apagó en los datos y no solo en la
  pantalla: `pricing.service` valida los dos umbrales, así que esconder el
  número habría dejado al checkout rechazando un carrito por un mínimo que la
  landing nunca mostró. Con 0 las dos guardas quedan inertes y el código sigue
  en pie por si vuelve la regla.
- `DeliveryChecker` quedó en dos tarjetas (despacho y ETA) en vez de tres, y la
  trust bar deja de empujar el ítem «Pedido mínimo» en vez de imprimir «Sin
  mínimo»: una fila sobre una regla que no existe es ruido.
- De paso, `page.tsx` ya no le pasa las filas de Prisma completas a
  `DeliveryChecker`, que es client component: va un view model de cuatro
  campos.

`minOrderAmount` vive en `create` del upsert de settings, así que el seed no lo
corrige en una DB ya poblada: se bajó a 0 con un `UPDATE` directo.

Queda pendiente `freeDeliveryFrom`, todavía en 35.000 — con la carta nueva son
unas cuatro pizzas de 32 cm. Decisión de negocio, sin tocar.

### Header y footer profesionales (2026-08-05)
Header en dos filas: barra de utilidad (horario de hoy, dirección, `tel:`,
WhatsApp; oculta bajo `sm`) + barra principal (logo o ícono de fallback,
nombre, badge en vivo, nav de 4 anclas, tema, carrito). Nuevo: skip link a
`#contenido`, nav con sección activa vía un solo `IntersectionObserver`
(`rootMargin: -30%/-55%`), subtotal del carrito al lado del contador en `lg`,
`aria-live` para el conteo, y el sheet móvil ahora se cierra al tocar un
ancla (antes tapaba la sección a la que acababa de scrollear) y lleva estado,
horario y contacto.

Footer en 4 columnas server-side (cero JS): marca + ETAs + redes, contacto
(`tel:`, `wa.me`, `mailto:`, dirección enlazada a Google Maps), anclas, y los
7 días de `getWeeklySchedule()`. Barra inferior con © y link a
`/admin`. Sin badge abierto/cerrado: con `revalidate = 60` y nada que lo
refresque abajo, mentiría; el badge vivo queda solo en el header.

Anclas nuevas en la landing: `#cobertura`, `#como-pedir`, `#horarios`, todas
con `scroll-mt-28` por las dos filas del header (100px).

`buildWhatsAppUrl` salió a `src/lib/whatsapp-link.ts`: `whatsapp.ts` importa
el cart store, y meterlo en un server component arrastraba zustand al bundle
del server. El layout arma el link una vez y lo pasa a header y footer.

Badges de estado ahora usan `--success`/`--warning` en vez de emerald/amber
crudos, en el header y en `opening-hours.tsx`.

Pendiente si se sube un logo remoto: agregar el host a
`images.remotePatterns` en `next.config.ts` (hoy `logo` está vacío y se usa
el ícono de fallback).

### Trust bar centrada (2026-08-05)
`trust-bar.tsx` pasó de `grid-cols-4` a flex con `flex-1`: los ítems son
condicionales (con delivery apagado quedan dos), así que el grid fijo dejaba
una celda vacía y la fila se veía corrida a la izquierda. Ahora cada ítem
ocupa una fracción igual y se centra dentro de la suya, con `sm:divide-x`
entre columnas. Móvil sigue en dos por fila (`basis-1/2`).

### Precio por tamaño en las cards (2026-08-05)
`product-card.tsx`: el selector de tamaño pasó de chips a filas
`[tamaño] [precio]`, una por opción, con el precio ya calculado
(`basePrice + priceDelta`, respetando `offerPrice`). Antes solo se veía el
precio del tamaño seleccionado, así que comparar costaba un tap por tamaño.
Los productos del seed tienen 2 o 3 opciones; las filas apiladas caben en la
card de 2 columnas del móvil, los chips en línea no.

El precio grande salió de su fila propia y se montó en el botón
(`Agregar · $X`, ancho completo): un solo target, más grande en móvil, y sin
mostrar dos veces el mismo número. Con oferta aparece «Antes $X» tachado
arriba. Agotado deja el botón deshabilitado con el texto «Agotado».

`aria-pressed` en cada fila (patrón de toggle button, navegable con Tab) en
vez de `role="radio"`, que exigiría manejar flechas a mano.

La card abre en el **tamaño más grande disponible**
(`largestAvailableOption`, mayor `priceDelta` entre las opciones con
`isAvailable`), no en el que trae `isDefault` (el seed marca el chico). El
botón sugiere la familiar y bajar de tamaño cuesta un tap. `isDefault` sigue
en el schema para el checkout, pero la card ya no lo mira.

### Hero editorial con overlap (2026-08-05)
El hero salió de `page.tsx` a `src/features/storefront/hero.tsx` (server
component, cero JS). Era foto a sangre con el texto encima y un scrim
`from-black/70`; ahora la foto es una placa `rounded-2xl` en las columnas 4-12
y la copy va en un panel propio que monta sobre ella (columnas 1-6, misma
`row-start`), tipo portada de revista.

- **El panel existe por contraste, no por estética.** El texto sobre una foto
  que sube el admin solo se salva con un scrim pesado, que aplana la foto. En
  panel el contraste es fijo: `foreground` sobre `background`, en light y dark,
  pase lo que pase con la imagen.
- **A 360px el solape se apila**: foto arriba, panel con `-mt-12`. El solape
  sobrevive sin comerse el ancho del texto. Medido con CDP:
  `scrollWidth == 360`, cero elementos fuera del viewport.
- El fondo es un degradado (`from-secondary/60` a transparente), no una banda
  de altura fija: la banda dejaba una costura horizontal visible cruzando el
  panel en móvil y todo el ancho en dark.
- Decoración: una sola regla `bg-primary` de 8px antes del kicker y un marco
  `border-primary/30` desplazado 8px bajo la foto, solo en `lg`. Nada de eso
  aparece en móvil, donde el espacio vale más.
- **Foto propia**: `public/hero/margarita.jpg` (1213×1600, re-encodeada a
  mozjpeg q82, 283 kB), reemplaza la de Unsplash. Es vertical, de teléfono, así
  que el marco es `aspect-square` en móvil y `aspect-4/3` desde `sm`: en 16:10
  la pizza quedaba reducida a una banda, y en cuadrado a 1280px el hero medía
  ~700px y empujaba la trust bar fuera del fold. La foto ocupa las columnas
  6-12 (7 de 12). El banner `MENU_TOP` sigue
  en Unsplash: no se usa hoy, queda como deuda.
- CTA secundario nuevo a `#cobertura`: la primera objeción real es «¿me
  llega?», y estaba a tres secciones de scroll.
- `animate-fade-up` una sola vez sobre el panel, sin escalonado por elemento.
  El escalonado viejo (`[animation-delay:100..300ms]`) retrasaba el LCP a
  cambio de nada.

Tradeoff: la foto ya no ocupa `70vh` a sangre, así que pesa menos como imagen
y más como composición. Si la que sube el admin es mala, se nota más, porque
está enmarcada en vez de tapada por texto.

### Agregados de la carta (2026-08-05)
Los once agregados reales (`Cebolla morada`, `Tomate cherry`, `Extra queso`,
`Champiñón`, `Pimentón`, `Aceituna`, `Choclo`, `Tocino`, `Jamón pierna`,
`Salame`, `Pepperoni`) reemplazan a los inventados por el seed viejo, que
además eran inalcanzables: `product-card.tsx` mandaba `extras: []` fijo, no
existía selector. El carrito ya sabía pintarlos y nunca le llegaba ninguno, y
«Cómo pedir» prometía «escoge el tamaño y los extras» sin que se pudiera.

- **Migración `variant_option_extra_price`.** La carta cobra el agregado por
  tamaño de pizza y no por agregado: $700 en 24 cm, $1.000 en 32 cm, sea cebolla
  o pepperoni. `Extra.price` es un número único y `ProductExtra.priceOverride`
  es por producto, así que ninguno de los dos lo expresa. La columna nueva es
  `VariantOption.extraPrice Int?`: **el tamaño es el que fija el precio del
  agregado**, y `null` cae al precio de catálogo del extra.
- `pricing.service` toma el `extraPrice` de la opción de tamaño seleccionada y
  solo cae a `priceOverride ?? extra.price` si no hay ninguna. El precio lo
  sigue armando el server; el cliente manda ids.
- **Selector en la tarjeta del producto, no en el carrito.** Va colapsado bajo
  el tamaño: once chips abiertos en cada tarjeta empujan el botón de compra
  fuera de pantalla en un teléfono, y el pedido normal es la pizza como viene.
  Cerrado muestra el contador. Al agregar al carrito se limpia la selección: la
  tarjeta se reusa para el siguiente pedido y dejar los chips marcados cobraba
  la segunda pizza como la primera.
- Los agregados viejos (`Palta extra`, `Pebre`, `Papas fritas`…) quedan
  `isActive: false`, no borrados: `order_item_extras` los referencia.
- **Bug de orden, preexistente y recién visible:** `product_extras.sortOrder`
  salía del índice de `extra.findMany`, que responde en el orden que Postgres
  quiera, así que los chips salían barajados. Ahora se reordenan contra la lista
  del seed antes de escribir. Las filas se borran antes de recrearse, como ya
  se hacía con tags e ingredientes.

Verificado con Chromium headless + CDP sobre la página real: en 32 cm los chips
dicen `+$1.000` y el botón pasa de `$10.000` a `$12.000` con dos agregados; al
cambiar a 24 cm los mismos chips pasan a `+$700` y el botón a `$6.900`
(5.500 + 700 + 700). La línea del carrito llega como
`Pepperoni 24 cm + Cebolla morada, Tomate cherry — $6.900`.

Falta la sección **Bebidas** de la carta (`Lata 350 cc: $1.200`): es un producto
aparte, no un agregado, y el menú hoy es una grilla plana titulada «Nuestras
pizzas». Pendiente de definir cómo se modela.

### Falta
1. QA manual en navegador (lo hace Felipe): agregar pizza con tamaño →
   carrito → checkout → confirmar pedido en Postgres + WhatsApp se abre
   con mensaje correcto. Login admin con `ADMIN_PASSWORD`, togglear
   abierto/cerrado y disponibilidad, confirmar reflejo en la landing.
2. Decidir `minOrderAmount` y `freeDeliveryFrom` contra los precios nuevos.

### Notas
- `npm audit` reporta 3 vulnerabilidades high, todas transitivas
  (`postcss`/`sharp` bajo `next`). No se tocan: el "fix" propuesto
  degrada `next` a 9.3.3.

---

## Infraestructura dev
Postgres Docker `co-pg`, puerto **5435** (5432-5434 ocupados por otros
proyectos). `npm run dev` / `build` / `npx prisma studio` funcionan.

`package.json` pide `next@^15.1.4` pero el rango ya resuelve a **15.5.22**.
Si algo se rompe sin que nadie haya tocado el código, mirar ahí primero.

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
