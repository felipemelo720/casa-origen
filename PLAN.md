# Casa Origen — plan de proyecto

Pedidos de pizza. Next.js 15 App Router + TypeScript + Prisma + PostgreSQL.
Cuentas de cliente opcionales (email + password), sin RBAC. Producción: VPS
Debian 12 + Docker + Nginx.

---

## Pivote arquitectónico (2026-08-02/03) — CÓDIGO LISTO, FALTA QA

Bajado de 26 páginas (e-commerce completo, RBAC, checkout+tracking propio)
a **2 páginas** (`/` y `/admin`), calcado de `~/arrozenwok.cl` pero
manteniendo Postgres como fuente de verdad. Checkpoint pre-pivote en git:
commit `b78a0f6`.

| Dimensión | Antes                                 | Ahora                                     |
| --------- | ------------------------------------- | ----------------------------------------- |
| Páginas   | 26                                    | `/` y `/admin`                            |
| Menú      | DB + CRUD admin                       | DB, sin CRUD (solo toggle disponibilidad) |
| Pedido    | Checkout propio + tracking por código | Guarda en DB + abre WhatsApp              |
| Admin     | RBAC, 20 rutas                        | 1 página, password único (cookie)         |

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
- Checkout: `placeOrderAction` sigue guardando en Postgres y devuelve el
  `wa.me` ya armado (ver «WhatsApp del checkout»). Número sale de
  `RestaurantSettings.whatsapp`. Borrado `/pedido`, `/pedido/[code]`
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

| Pizza               | 24 cm |  32 cm |
| ------------------- | ----: | -----: |
| Pepperoni           | 5.500 | 10.000 |
| Napolitana          | 6.000 | 10.000 |
| Tres Carnes         | 6.500 | 11.000 |
| Mechada             | 7.500 | 12.500 |
| Cherry Margarita 🌿 | 5.500 | 10.000 |
| Rústica             | 6.000 | 10.000 |
| La Huerta 🌿        | 6.000 | 10.500 |

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

La sección **Bebidas** entró en el mismo commit (`83ef2de`): categoría nueva
en el seed, sin migración — `menuByCategory` en `page.tsx` ya agrupaba por
categoría genéricamente, así que alcanzó con datos. Un producto por ahora,
Coca-Cola Zero $1.200, sin `VariantGroup` (precio único, sin tamaños).

### QA manual en navegador (2026-08-05)

Corrido con Chromium headless + CDP contra la app real (`localhost:3001`),
no adivinado.

- **Cliente:** Pepperoni 24 cm al carrito → `Continuar al pago` → PICKUP →
  Débito → `Confirmar pedido`. Orden cayó en Postgres (`CO-260805-0001`,
  `type PICKUP`, `total 5.500`, línea `Pepperoni x1`) y disparó
  `openWhatsAppOrder` (toast «enviado por WhatsApp»). Cero errores de
  consola o red. Fila de prueba borrada y `soldCount` de Pepperoni
  revertido después.
- **Admin:** login con `ADMIN_PASSWORD` OK. `Cerrar negocio` →
  `/api/open-state` pasa a `{"isOpen":false,"reason":"Estamos cerrados
temporalmente."}` en el momento, sin esperar `revalidate`. `Abrir
negocio` revierte. `Agotar` en Pepperoni → la landing (`/`) muestra
  «Agotado» en la card. `Activar` revierte. Estado final de la DB
  confirmado idéntico al inicial (`acceptingOrders: true`,
  `deliveryEnabled: true`, Pepperoni `AVAILABLE`, 0 órdenes).

### Cuentas de cliente (2026-08-06)

Hipótesis: el cliente pide siempre como invitado, la pizzería no sabe quién
vuelve ni puede premiar fidelidad. Con cuenta se registra el historial de
compras y quedan enganchados los beneficios.

Auth **email + password** (se descartó teléfono+OTP: obliga a un proveedor de
SMS y a pagar por mensaje). **El guest checkout se mantiene**: la cuenta es
incentivo, no peaje — el principio #1 de `AI-ROLE.md` es el camino de
conversión, y un registro obligatorio antes de la primera pizza lo corta.

- **Página nueva `/cuenta`.** Rompe el "dos páginas" del pivote a propósito:
  lee cookie de sesión, así que no puede vivir en la landing estática
  (`dynamic = 'force-dynamic'`, `robots: noindex`). Firmada muestra el
  historial; sin firmar, el formulario. Ícono de usuario nuevo en el header.
- **`Customer.passwordHash String?`** (migración `customer_accounts`). Nullable
  porque el checkout ya crea filas de invitado por teléfono: haber pedido no es
  tener cuenta, y un invitado nunca debe poder "iniciar sesión" como nadie.
  `email` pasó a `@@unique` (es el identificador de login); en Postgres los
  `null` siguen repitiéndose, así que las filas de invitado sin correo no se
  ven afectadas.
- **Hash con `scrypt` de `node:crypto`** (`lib/security/password.ts`), cero
  dependencias nuevas: argon2 ya se sacó una vez de este repo y bcrypt/argon2
  arrastran un módulo nativo al Docker por una tabla de clientes. El formato
  `scrypt$N$r$p$salt$hash` lleva los parámetros adentro, así que subir el costo
  después no invalida las filas de hoy.
- **Cookie `customer_session` = `<id>.<expiry>.<hmac>`**, sin tabla de
  sesiones. No se parece a `admin-session.ts` porque ese compara contra un
  único secreto compartido y este tiene que identificar **cuál** cliente.
  `sameSite: 'lax'`, no `strict`: el salto a WhatsApp saca al cliente del sitio
  y `strict` mataría la cookie al volver. Consecuencia asumida: no hay
  revocación server-side; el botón de pánico es rotar `AUTH_SECRET`, que cierra
  todas las sesiones de una.
- **`AUTH_SECRET` nuevo en `env.ts`**, separado de `ADMIN_PASSWORD` a
  propósito: cambiar la clave del admin no debe desloguear clientes, y la clave
  del admin no debe hacer de llave de firma.
- **Login sin oráculo de existencia.** «Correo o contraseña incorrectos» tapa
  los tres casos (no existe, es invitado sin password, password mala), y el
  caso "no existe" igual gasta el tiempo de hashing para que no responda más
  rápido que el caso real.
- **Registro adopta la fila de invitado del mismo teléfono** — ese historial es
  de esa persona — pero solo si todavía no tiene credenciales; si no, cualquiera
  reclamaría la cuenta ajena escribiendo su número.
- **`placeOrder` prefiere la sesión sobre el teléfono del formulario**, así
  editar ese campo no puede mover la compra al historial de otro. Los invitados
  siguen con el upsert por teléfono.
- Tabs y botones de submit con nombres distintos («Iniciar sesión»/«Entrar»,
  «Crear cuenta»/«Registrarme»): dos controles con el mismo nombre accesible en
  la misma pantalla son ambiguos para quien navega por nombre. Salió del QA.

QA con Chromium headless + CDP contra `localhost:3001`: registro → sesión →
recarga → logout → login con password mala (rechaza) → login correcta. Cookie
no legible desde JS. Cero errores de consola. Fila de prueba borrada después.

### QA del pedido con sesión + incentivo definido (2026-08-06)

Cerrado el pendiente que quedaba de cuentas: **el pedido de un cliente logueado
sí cae en su historial**, verificado en browser, no deducido del código.

Corrido con Chromium headless + CDP contra `localhost:3001`. La prueba tipea a
propósito un teléfono **distinto** al de la cuenta (`+56911112222` contra
`+56988877766`), que es exactamente el caso que la guarda de `placeOrder`
existe para cubrir: la orden `CO-260806-0002` quedó con el `customerId` de la
sesión y no con el del teléfono del formulario. Apareció en `/cuenta`
(`Pepperoni x1`, $10.000), con `orderCount 1` y `totalSpent 10.000`. Cero
`Runtime.consoleAPICalled` de error y cero `Network.loadingFailed`. Fila de
prueba, cliente de prueba y `soldCount` revertidos después: la DB quedó igual
que antes (0 órdenes).

**El incentivo de la cuenta son premios y descuentos futuros**, y nada más.
Decisión de negocio tomada: no hay puntos, ni niveles, ni cupones dirigidos.
El copy de `/cuenta` queda en futuro a propósito — principio #2, la UI no
promete lo que el server no puede honrar. Sin sesión, el subtítulo nombra los
beneficios en preparación y repite que se puede pedir sin cuenta. Con sesión,
la línea suelta del final pasó a una tarjeta «Premios y descuentos» que dice
que los pedidos ya se están registrando, así el historial vale algo hoy y no
solo cuando salgan los beneficios.

Verificado a 360px, 768px y 1280px en light y dark: cero scroll horizontal.
`tsc --noEmit` y `lint` limpios.

Residuo detectado, no tocado: el cliente `Felipe` (`+56912345678`) quedó con
`orderCount 1` y `totalSpent 5500` del QA del 2026-08-05 — esa corrida borró
la orden pero no revirtió los contadores de `recordOrder`.

### Falta

1. Decidir `minOrderAmount` y `freeDeliveryFrom` contra los precios nuevos.
2. Cuentas, postergado a propósito (el módulo se dio por cerrado hoy):
   recuperar contraseña (sin proveedor de email, el canal habría que
   decidirlo), editar perfil y repetir pedido desde el historial.

### Notas

- `npm audit` reporta 3 vulnerabilidades high, todas transitivas
  (`postcss`/`sharp` bajo `next`). No se tocan: el "fix" propuesto
  degrada `next` a 9.3.3.

---

## Flujo de carga de `/` (2026-08-06)

Auditoría del arranque de la landing. Seis arreglos aplicados; queda uno.

**Problema:** cada render de `/` pedía la misma fila de `restaurant_settings`
cuatro veces y las siete de `business_hours` tres veces —
`generateMetadata` + `(storefront)/layout.tsx` + `page.tsx`, y `getOpenState()`
abre otro `settings.get()` por dentro. Además react-query se cargaba en todas
las rutas para un único consumidor, y el badge de abierto/cerrado consultaba la
DB cada 15s por pestaña abierta.

**Hecho**

1. `settingsRepository.get` y `businessHourRepository.findAll` envueltos en
   `cache()` de React (`operations.repository.ts`). Dedup por request:
   13 → 8 queries por regeneración. `getOpenState()` y `getWeeklySchedule()`
   se benefician sin tocarlos.
2. `QueryProvider` sale de `app-providers.tsx` y baja a `CartDrawer`, envolviendo
   solo el paso de checkout. Su único consumidor es `CheckoutForm`
   (`useQuery` de opciones y de preview de totales). /admin y /cuenta dejan de
   pagar react-query.
3. Poll de `/api/open-state` de 15s a 60s (`storefront-header.tsx`). La ruta es
   `force-dynamic`: cada tick era una query por pestaña. `revalidatePath('/')`
   en `admin.actions.ts` ya hace que una visita nueva vea el cambio al instante;
   el poll solo cubre pestañas ya abiertas, y `visibilitychange`/`focus` siguen
   refrescando en el acto.

4. `CartDrawer` ya no se importa estático desde el layout. Nuevo
   `cart-drawer-mount.tsx`: `next/dynamic` con `ssr: false` (el drawer lee el
   carrito de localStorage, no hay nada que renderizar en el server), montaje
   al primer `isOpen` y latch para no desmontarlo al cerrar — desmontarlo
   mataría la animación de salida y volvería a pedir el chunk. El chunk se
   precarga en `requestIdleCallback` (fallback `setTimeout` 2s), así el primer
   tap abre el sheet en vez de esperar la red. Saca `CheckoutForm` (380
   líneas) + react-hook-form + zodResolver + react-query de la primera carga.
5. `getCheckoutOptionsAction` eliminado. Comunas, métodos de pago, WhatsApp y
   `deliveryEnabled` bajan como prop `CheckoutOptions` desde
   `(storefront)/layout.tsx`, narrowed ahí (son filas de Prisma y el checkout
   es client). Mata un roundtrip al abrir el checkout y el fallback
   `deliveryEnabled ?? true`, que mostraba delivery por un instante aunque
   estuviera apagado.
6. `communeRepository.findAllActive` también con `cache()`: ahora la piden el
   layout (checkout) y la página (`DeliveryChecker`).

**Tradeoffs asumidos**

- El caché de react-query muere al volver del checkout al carrito (el provider
  se desmonta con el paso). Aceptado: el preview de totales hay que recalcularlo
  igual, es la única fuente de verdad de precios.
- Una pestaña ya abierta puede mostrar el badge hasta 60s desfasado en vez de
  15s. El checkout valida de nuevo server-side, así que el peor caso es un
  rechazo explicado, no un pedido inválido.
- Las opciones de checkout quedan congeladas en el HTML de la landing hasta el
  siguiente `revalidate` (60s). Antes se pedían frescas al abrir el drawer. Un
  método de pago recién desactivado puede seguir listado por un minuto; el
  `placeOrder` lo rechaza igual.

**Verificado** con Chromium headless + CDP: recorrido agregar → carrito →
checkout, `paymentMethods` renderizados desde el prop, cero
`Runtime.consoleAPICalled` de error y cero `Network.loadingFailed`.

**Pendiente**

- `ProductCard` es client y recibe `ProductDetail` entero: cada producto se
  serializa completo al payload RSC. Falta view model estrecho + dejar la
  carcasa server con solo el selector de tamaño y el botón como leaf client.
  Es el único refactor real de la lista.

---

## Solo transferencia y efectivo (2026-08-06)

**Problema.** El checkout ofrecía Débito y Crédito ("máquina POS a domicilio"),
que el local no tiene. El cliente elegía un método que después no podía pagar:
la UI prometía algo que la operación rechaza.

**Cambio.** `prisma/seed.ts` → `seedPaymentMethods()`. Métodos activos:
`TRANSFER` (sortOrder 1) y `CASH` (sortOrder 2). `DEBIT` y `CREDIT` quedan con
`isActive: false`. El bloque `update` del upsert ahora repite `instructions`,
`requiresChange`, `isActive` y `sortOrder`, así que el estado se corrige con
`npx prisma db seed` sin resetear la DB.

Ninguna capa más se tocó: `paymentMethodRepository.findAllActive()` ya filtra
por `isActive` y `checkout.service.ts` ya rechaza un método inactivo
server-side. Esconderlo en la UI no era la validación; la validación ya estaba.

**Tradeoff.** Se desactivan en vez de borrarse: `Order.paymentMethodId` es
`onDelete: Restrict` y los pedidos históricos quedarían huérfanos. Costo: dos
filas muertas en `payment_methods` y el enum `PaymentMethodCode` conserva
`DEBIT`/`CREDIT`. Reactivar es un flag, no una migración.

**Verificado.** `psql`: TRANSFER/CASH `t`, DEBIT/CREDIT `f`.
`npx tsc --noEmit && npm run lint` limpios.

---

## WhatsApp del checkout: link tocable + mensaje server-side (2026-08-07)

**Problema.** Dos fallas en el mismo paso, el último del embudo.

1. El pedido se guardaba y recién entonces el cliente llamaba
   `window.open(wa.me/…)`. El `await` de la server action ya consumió el gesto
   del usuario, así que Safari y Chrome móvil — el caso mayoritario — bloquean
   el popup. El pedido queda en Postgres y el operador no se entera nunca.
   Peor: el drawer se cerraba con un toast «enviado por WhatsApp» que era
   mentira.
2. El mensaje se armaba en el browser con `estimateLineTotal`, la estimación
   del carrito. El total del pedido lo calcula `pricing.service`. Con un cupón,
   una promo o un despacho por comuna, el operador leía un monto distinto al de
   la fila.

**Capas tocadas.** `lib` (nuevo) → service → action → UI.

**Cambio.**

1. `src/lib/whatsapp-order-message.ts` (nuevo, puro, testeado):
   `buildWhatsAppOrderMessage` + `buildWhatsAppOrderUrl`. Toma el pedido ya
   priceado; devuelve `null` si no hay número configurado.
2. `checkout.service.ts` arma la URL después de la transacción, con `priced.*`
   y `settings.whatsapp`, y ahora devuelve `{ order, whatsappUrl }`.
   `estimatedMinutes`, `cashGiven` y `changeDue` subieron fuera del `withTransaction`
   para reusarse en el mensaje (antes se calculaban inline en el `create`).
3. `placeOrderAction` propaga `whatsappUrl` en su `Result`.
4. `checkout-form.tsx`: fuera `openWhatsAppOrder`; `onPlaced` pasa
   `{ code, whatsappUrl }` hacia arriba.
5. `cart-drawer.tsx`: tercer paso `'placed'`. El drawer **no** se cierra:
   muestra el código y un `<a href={whatsappUrl} target="_blank">` como botón
   primario. Un tap real, cero popup bloqueado. Sin número configurado, el
   texto dice «te llamamos» en vez de prometer un WhatsApp.
6. Borrado `src/lib/whatsapp.ts` (el builder cliente, ya sin consumidores) y el
   campo `whatsapp` de `CheckoutOptions`: el form nunca más ve el número.
7. `checkout.service.test.ts` mockea `customer-auth.service` — el módulo real
   arrastra las sesiones, que parsean el env del server al importar. El archivo
   fallaba entero por eso.

**Tradeoffs asumidos.**

- **Un tap más.** Antes (en teoría) WhatsApp se abría solo; ahora el cliente
  toca «Enviar por WhatsApp». Es un tap contra un pedido que se pierde: en
  móvil el auto-open no ocurría.
- **URL con tope de 1800 chars.** `buildWhatsAppOrderUrl` va sacando líneas de
  ítems hasta que la URL codificada entra, y agrega «… y N productos más». Los
  totales, el cliente y la dirección nunca se recortan. El detalle completo
  está en `/admin`; el mensaje es aviso, no fuente de verdad.
- **Sigue dependiendo del cliente.** Si no toca el botón, el operador solo ve
  el pedido al entrar al panel. La alternativa (WhatsApp Cloud API, empuja el
  mensaje desde el server) cuesta token de Meta + webhook: se hace solo si se
  pierden pedidos de verdad.

**Verificado.** `npx tsc --noEmit`, `npm run lint` y `npx vitest run` (14
archivos, 134 tests) limpios; 6 tests nuevos cubren truncado, número sin
formato y ausencia de número. Pendiente de QA en navegador el recorrido real.

**Número real.** `restaurant_settings.whatsapp` = `+56920499873`, en DB y en el
`create` **y** el `update` del upsert de `seedSettings()`, así que se corrige
con `npx prisma db seed` sin resetear.

---

## Limpieza posterior al cambio de WhatsApp (2026-08-07)

Tres arreglos chicos, en orden de "lo que es falso → lo que puede caerse →
lo que es deuda".

**1. `how-to-order.tsx` mentía.** El paso 3 decía «Al confirmar se abre
WhatsApp». Desde el cambio de arriba ya no se abre solo: se guarda el pedido y
aparece un botón. Copy nuevo: «Nos lo envías por WhatsApp» / «Guardamos tu
pedido y te mostramos un botón para enviárnoslo». La rama sin número
(«Nosotros te llamamos») no se tocó.

**2. Unsplash fuera de todo.** Era más grande que el banner que se había
detectado:

- `banners`: la fila `MENU_TOP` («Delivery gratis sobre $35.000», con subtítulo
  de Providencia/Ñuñoa — comunas que no son las nuestras) apuntaba a Unsplash.
  Ninguna sección la renderiza. Borrada de la DB y de `seedBanners()`.
- `products`: 5 pizzas del seed viejo (Margherita, Hawaiana, Cuatro Quesos,
  Vegetariana, Especial Casa Origen) seguían con `image` de Unsplash, más 5
  filas en `product_images`. Están `isActive: false` desde que entró la carta
  real, así que no se renderizaban — pero reactivar una desde `/admin` habría
  tirado `[object Event]`. `image` a `NULL` y las filas de `product_images`
  borradas.
- `next.config.ts`: `images.unsplash.com` fuera de `remotePatterns`. Queda solo
  el blob store. Ahora una URL de Unsplash la rechaza `next/image` en vez de
  romper la página cuando la foto desaparezca.

DB verificada en cero: `products`, `product_images`, `categories` y `banners`
sin ninguna referencia a Unsplash.

**3. `amber-*` hardcodeado, en dos archivos.** El aviso de "cerrado" estaba
duplicado en `hero.tsx` y en `page.tsx` con `border-amber-500/30
bg-amber-500/10 text-amber-700 dark:text-amber-300` — colores fuera de
`globals.css`, prohibición dura.

- Nuevo `src/components/shared/closed-notice.tsx`: un solo componente para los
  dos usos (son dominios distintos mostrando el mismo estado). Lleva
  `role="status"`, que antes no tenía: el estado abierto/cerrado se refresca
  por poll y un lector de pantalla no se enteraba.
- Nuevo token `--warning-emphasis` en `:root`, `.dark` y `@theme`. Tercer rol
  además de `--warning`/`--warning-foreground`: texto sobre un fondo
  `bg-warning/10`. Hacía falta porque `--warning` es un ámbar claro que no
  llega a 4.5:1 sobre la tarjeta, y `--warning-foreground` (pensado para fondo
  sólido) es ilegible en dark.

**Tradeoff.** Un token más que mantener en los dos temas. La alternativa —
`text-warning` a secas — no pasa AA en light; el `amber-` hardcodeado tampoco
es aceptable. Se paga el token.

**Contraste calculado** (conversión oklch→sRGB, no a ojo): texto 7.12:1 light /
9.79:1 dark. Borde a 65% de `--warning-emphasis`: 3.31:1 light / 5.63:1 dark —
se usa ese y no `--warning`, que a opacidad completa da 1.97:1 en light y deja
el bloque sin leerse como bloque.

**Verificado.** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (140
tests) limpios. `GET /` 200, HTML sin `unsplash` y con el copy nuevo. Falta el
QA en navegador (360px, dark, teclado), que sigue pendiente junto al del paso
`'placed'`.

## `/admin` a 360px: overflow y objetivos táctiles (2026-08-07)

**Problema del operador.** El panel se opera desde el teléfono con las manos
ocupadas, pero estaba dimensionado para pantalla ancha. A 360px el ancho útil
real es 280px (main `px-4` → 328, section `p-6` → 280) y varios bloques pedían
más, con scroll horizontal y botones de 32px.

Cuatro arreglos, todos en `src/app/(admin)/admin/page.tsx` y
`src/features/admin/stat-card.tsx`:

1. **Stats.** `grid-cols-3` daba 85px por columna contra una card que necesita
   ~100px solo de padding + icono. Ahora es una columna (`space-y-2`) con
   `StatCard` en fila slim: icono `size-9`, valor a la derecha con
   `tabular-nums`. No se dejó `sm:grid-cols-3` porque el contenedor es
   `max-w-lg`: incluso en desktop tocan 145px por columna y volvía a romper.
2. **Horarios.** La fila medía 310px (`w-20` + 2×`w-24` + gaps). Pasa a
   `grid-cols-[4.5rem_1fr]` con los dos `input[type=time]` en `flex-1 min-w-0`,
   así el ancho lo pone el contenedor y no el input.
3. **Toggles de negocio y delivery.** Los pares abrir/cerrar y
   activar/desactivar tenían siempre un botón `disabled`, ocupaban 134px cada
   uno y "Desactivar delivery" desbordaba (los botones son
   `whitespace-nowrap`). Ahora hay un solo botón que muestra la acción
   contraria al estado actual.
4. **Objetivos táctiles.** Los botones del menú eran `size="sm"` (`h-8`, 32px).
   Estrella pasa a `size-11` con `aria-label`, agotar/activar a `h-11`, y
   también los inputs de hora y "Guardar horarios".

**Tradeoff.** Las stats ahora ocupan tres filas en vez de una: ~120px más de
scroll a cambio de que los montos se lean. Y con el toggle único se pierde la
señal redundante del botón deshabilitado; el estado sigue explícito arriba
(punto de color + ABIERTO/CERRADO), que es donde el operador lo mira.

Aparte: `StatCard` pasó de `bg-card` a `bg-background` porque estaba dentro de
una section `bg-card` y no se distinguía.

**Verificado.** `npx tsc --noEmit` y `npm run lint` limpios. **Sin
`npm run build`**: hay dev server levantado. Pendiente el QA en navegador —
este CT no tiene Chromium instalado. Sigue pendiente lo no pedido: los colores
`green-500`/`red-600`/`amber-600` hardcodeados en el panel violan la regla de
tokens y en dark el `text-*-600` queda bajo 4.5:1.

## El día de la semana se calculaba en UTC (2026-08-07)

**Hipótesis.** El cliente entra a las 21:00 un viernes, la barra del header le
dice «Hoy atendemos de 12:00 a 23:00» —el horario del sábado— y un domingo a
las 20:00 le dice «Hoy sin horario publicado» con el local abierto, porque lee
la fila del lunes, que está cerrado.

**Causa.** `schedule.service.ts` resolvía el día con `now.getDay()`, o sea el
día del server. El CT corre en UTC (`timedatectl` → `UTC`) y el proceso pm2 no
tiene `TZ` en el environment (verificado en `/proc/<pid>/environ`). Chile está
en UTC-4: **de 20:00 a 23:59 hora local el server ya está en mañana**. La
ventana rota es exactamente la hora peak de una pizzería.

Alcance: `isToday` en `getWeeklySchedule()`, que alimenta la barra de utilidad
del header, el sheet móvil, `opening-hours.tsx` y el footer.

**Cambio.** `SHOP_TIME_ZONE = 'America/Santiago'` y `dayOfWeekInShopTime()` en
`schedule.service.ts`, con `Intl.DateTimeFormat` en vez de `getDay()`. La
timezone queda en el código, no en el environment: una env var arregla el
síntoma pero se pierde en silencio la primera vez que alguien levante el
proceso sin ella.

Si `Intl` devolviera un weekday desconocido (inalcanzable con Node full-ICU)
se loguea por `pino` y recién ahí cae a `now.getDay()`. El fallback no se
traga el error, que es justo el modo de falla que este código existe para
matar: un día equivocado en silencio.

**Verificado.** Dos tests de regresión en `schedule.service.test.ts`
(viernes 22:00 y domingo 21:00 en Paine, ambos ya en el día siguiente UTC).
Ruta de fallo confirmada a mano, no asumida:

```
TZ=UTC node -e "..."  →  getDay UTC: 6 | Santiago: Fri
```

El código viejo devolvía 6 (sábado) donde el test espera 5 (viernes).
`npx tsc --noEmit`, `npm run lint` y `npx vitest run` (142 tests) limpios.

**Tradeoff.** La timezone queda hardcodeada. Es correcto mientras haya un solo
local; un segundo local en otra región obliga a moverla a `Settings`.

**Pendiente de este mismo hallazgo:** falta `TZ=America/Santiago` en el proceso
pm2 como segunda línea de defensa. Todavía no aplicado porque implica reiniciar
el sitio en producción. Sin eso, el resto de las fechas del server (la serie
diaria de ventas de `/admin`, `createdAt` en `/cuenta`) siguen formateándose en
UTC.

**Desplegado** el 2026-08-08 en el commit `bf0d0b2`, junto con el cambio de
tema de abajo. Hasta esa fecha estuvo sin desplegar, en el working tree.

## Tema oscuro por defecto en la primera visita (2026-08-08)

**Decisión de producto, no bug.** `AppProviders` arrancaba en `light` con
`enableSystem={false}`. Ese `light` venía de un arreglo anterior: con
`defaultTheme="system"`, un Android en modo oscuro recibía la paleta dark sin
que nadie se lo preguntara. La corrección de entonces apagó `enableSystem` y
fijó `light`.

**Cambio.** `defaultTheme="dark"` en
`src/components/providers/app-providers.tsx`. Una sola línea, sin tocar
tokens: `:root` y `.dark` ya estaban completos, que es la razón por la que el
cambio es de una línea. `enableSystem` sigue en `false` y next-themes sigue
recordando la elección explícita: quien ya tocó el toggle y eligió light,
mantiene light.

**Tradeoff.** La primera visita deja de respetar la preferencia del dispositivo
para quien tiene el teléfono en modo claro — ve dark hasta que toque el toggle.
Se acepta porque la paleta pasa a ser una decisión de marca y no algo heredado
del sistema operativo del visitante. La alternativa honesta era volver a
`system`, que es justo lo que se descartó antes por dar una paleta que nadie
pidió.

**Verificado.** `npx tsc --noEmit`, `npm run lint`, `npm run format:check` y
`npx vitest run` (142 tests, 15 archivos) limpios. Confirmado en el HTML que
sirve producción, no solo en el fuente: el script inline de next-themes llega
con `("class","theme","dark",null,["light","dark"],null,false,true)` — tercer
argumento `defaultTheme`, séptimo `enableSystem`. `GET /` 200 en el puerto 3006.

**Pendiente.** El QA en navegador a 360px/768px/1280px y el recorrido con
teclado siguen sin hacerse: este CT no tiene Chromium instalado. Es la misma
deuda que arrastran los dos pasos anteriores.

## CI/CD activado (2026-08-08)

El workflow y el deploy pull-based existían desde el 2026-08-07 pero nunca
habían corrido: los tres commits que los agregaban seguían sin pushear
(`origin/main` en `69fdafc`) y las units de systemd estaban en el repo, no en
`/etc/systemd/system/`.

- Push de `69fdafc..bf0d0b2`. **Primera corrida de GitHub Actions**, verde
  ([run 31269205271](https://github.com/felipemelo720/casa-origen/actions/runs/31269205271)).
- `casaorigen-deploy.timer` instalado y habilitado, cada 5 minutos.

**Se habilitó sin haber probado nunca un deploy real.** Lo único que se había
visto era `deploy: already at bf0d0b2, nothing to do`, que no ejercita el pull,
ni el install, ni el build, ni el rollback. La regla de probar la ruta de fallo
estaba escrita en este mismo repo y no se siguió. El resultado está abajo.

## El primer deploy real tiró producción (2026-08-08)

Cinco minutos caído, de 17:47 a 17:52. Del journal:

```
17:41:48 deploy: main moved: 0d0ae10 -> bf0d0b2
17:44:40 sh: 1: husky: not found
17:44:41 deploy: ROLLBACK to 0d0ae10
17:47:16 deploy: rolled back — production is serving the previous release
```

Esa última línea era falsa: `.next` borrado, sin respaldo, pm2 en loop de
reinicio, `HTTP 000`.

**Cinco defectos, no uno.** Los dos últimos aparecieron recién al correr el
deploy de verdad; ninguna lectura del script los había mostrado.

1. **`npm ci` sin devDependencies.** La unit exporta `NODE_ENV=production`, npm
   saltea las dev, pero igual corre `prepare`, que es `husky` — devDependency.
   Muere con 127. Ningún deploy podía funcionar. Arreglado con
   `npm ci --include=dev` explícito, en la ruta normal y en el rollback, para no
   depender del `NODE_ENV` de quien invoque.
2. **El rollback borraba el build que estaba sirviendo.** Hacía `rm -rf .next` y
   buscaba un `.next.prev` que se crea mucho después. Casi todo lo que puede
   fallar —pull, install, migración— pasa antes de ese respaldo. Ahora solo
   toca `.next` si hay algo que reponer.
3. **El rollback afirmaba éxito sin comprobarlo.** La frase «serving the
   previous release» se imprimía siempre. Ahora hace health check con
   reintentos y, si no responde, loguea `ROLLED BACK BUT STILL DOWN — needs a
human`.
4. **Comparaba «distinto», no «atrasado».** Un commit hecho en el servidor y no
   pusheado dejaba HEAD adelante del remoto y eso se leía como «main moved»:
   rebuild para llegar al mismo árbol, y con historias divergidas el
   `pull --ff-only` falla a mitad de deploy. Ahora exige fast-forward con
   `git merge-base --is-ancestor`, lo que además garantiza que el commit
   desplegado es exactamente el que CI validó.
5. **`DATABASE_URL` ausente en `migrate deploy`.** El CLI de Prisma solo
   auto-carga `.env`; los secretos viven en `.env.production`, que Next lee por
   su cuenta. Por eso `next build` siempre anduvo y la asimetría era invisible.
   Estaba tapado por el defecto 1: ningún deploy había llegado tan lejos. Se lee
   la variable con `sed` en vez de hacer `source`, porque `.env.production`
   tiene al menos un valor con espacio sin comillas y `source` intentaría
   ejecutar la segunda palabra.

**Verificado de punta a punta**, con el timer apagado y el servidor puesto un
commit atrás a propósito: pull → `npm ci` → `migrate deploy` → build → restart →
`health check OK after 3 attempt(s)` → `deployed abcfcd3`. Recién después se
volvió a habilitar el timer.

El guard del defecto 2 quedó probado por un fallo genuino, no simulado: la
corrida que murió en `DATABASE_URL` cayó justo en la ventana que antes era
letal y el sitio siguió en `HTTP 200`, con el log diciendo
`no previous build to restore — leaving .next as it is`.

**Ciclo:** push desde cualquier máquina → Actions → el CT pregunta cada 5 min
si `main` avanzó **y** si CI quedó verde → pull + `prisma migrate deploy` +
build + restart + health check, con rollback de commit y de `.next` si algo
falla. Latencia de punta a punta: CI (~4 min) + hasta 5 min de timer + deploy
(~11 min, casi todo `npm ci` y `next build` en 2 vCPU).

**Tradeoff.** El deploy es pull y no push porque GitHub no llega a este
contenedor (red privada, sin port-forward). Se paga latencia y una corrida cada
5 minutos a cambio de no exponer nada hacia afuera.

**Deuda abierta.**

- Las credenciales son un PAT clásico en `/root/.git-credentials` (`chmod 600`),
  con alcance sobre toda la cuenta y no sobre este repo. Además pasó por un chat
  con una IA, así que hay que tratarlo como comprometido. Reemplazar por deploy
  key SSH o token fine-grained.
- `.gitignore` cubre `.next` pero no `.next.prev`. Si un deploy muere entre el
  respaldo y la limpieza final —`TimeoutStartSec`, OOM, kill— ese directorio
  queda como untracked y **todos los deploys siguientes mueren en
  `working tree is dirty`**. Una línea lo arregla.
- El deploy tarda ~11 min contra un `TimeoutStartSec=900`. Cuatro minutos de
  margen.
- Sin canal de alerta: un deploy fallido solo se ve con
  `journalctl -u casaorigen-deploy.service`. Ausencia de mensajes no es salud.
- Falta probar la rama del rollback que **sí** tiene respaldo (falla del build o
  del health, con `.next.prev` ya creado). Probarla exige tirar el sitio a
  propósito unos minutos.

## Los horarios del admin no se podían cambiar (2026-08-08)

**Problema del operador.** El lunes está cerrado y no hay forma de abrirlo; un
día abierto no se puede cerrar. El form de Horarios guarda sin error y no pasa
nada.

**Causa.** `admin/page.tsx` renderizaba los `input[type=time]` solo cuando
`!day.isClosed`. Un día cerrado era texto plano: sin input no hay entrada en
`formData`, y la action lo dejaba en `null`, es decir cerrado otra vez. En el
otro sentido tampoco había salida: los dos inputs eran `required`, así que no
se podía vaciar un día para cerrarlo. No existía ningún control de "cerrado" en
ninguna de las dos direcciones — solo se podían mover las horas de los días que
ya estaban abiertos.

Segundo bug, latente: `String(value || null)` con un input vacío daba la
**cadena** `'null'`, no `null`, y reventaba el regex `HH:mm` de zod con un
`ZodError` sin capturar.

**Arreglo.** Los inputs se renderizan siempre, para los 7 días, más una casilla
`${dayOfWeek}_closed` por fila. La casilla es lo único que decide el estado: un
checkbox sin marcar no se envía, así que su ausencia es lo que abre el día. La
action pasa a leerla y, fail closed, cierra igual cualquier día abierto al que
le falte una de las dos horas. `String(value || null)` pasa a
`value ? String(value) : null`.

Un día cerrado se guarda como 00:00–00:00, así que el form parte de
`FALLBACK_HOURS` (12:00–23:00) cuando `isClosed`: destildar la casilla y guardar
sin tocar nada abría el día con una ventana de cero minutos.

**Tradeoff.** La fila creció: dos inputs de hora + casilla. A 360px la casilla
cae a una segunda línea (`flex-wrap`), unos 44px más de alto por día, ~300px de
scroll en la sección. Se aceptó porque la alternativa —un `Switch` de Radix por
fila— convertía la primera parte de `/admin` en client component por 7 casillas
que un `input[type=checkbox]` nativo resuelve con cero JS.

**Sin verificar.** tsc, lint y los tests de `schedule` pasan, pero el guardado no
se ejerció en browser: la action no tiene test y no se abrió el panel. Falta
tildar y destildar un día contra la DB real.

**Fuera de alcance, anotado.** `getOpenState()` sigue ignorando `business_hours`
(decisión del 2026-08-04, más arriba). Estos horarios son vitrina: cambiarlos no
abre ni cierra la tienda, eso lo sigue haciendo `acceptingOrders`.

## Pedidos para eventos (2026-08-09)

**Problema.** El carrito sirve para una pizza, no para veinte. Quien organiza un
cumpleaños o un pedido de oficina no sabe cuántas pedir, quiere precio antes de
comprometerse y necesita fijar día y hora. Ese pedido hoy no existía en la
landing: o se iba, o escribía por WhatsApp sin que la página lo invitara.

**Qué se hizo.** `src/features/storefront/event-orders.tsx`, server component,
montado en `src/app/(storefront)/page.tsx` **después** del menú y antes de
`HowToOrder`. Card con dos objeciones respondidas (desde 5 pizzas, avisar con un
día) y un solo CTA a WhatsApp con mensaje prellenado
(`Somos ___ personas, el día ___ a las ___ hrs`). Sin número configurado cae a
`tel:`; sin número ni teléfono la sección no se renderiza — un CTA muerto es peor
que no tener sección.

**Cero backend.** No hay tabla, ni action, ni service, ni migración. El pedido de
evento vive en la conversación de WhatsApp. Cero JS de cliente: el First Load JS
de `/` no se movió.

**Tradeoff aceptado.** El pedido de evento **no queda en Postgres**, contra la
regla general de que WhatsApp es aviso y no fuente de verdad. Se aceptó porque
todavía no se sabe si alguien lo va a usar: primero medir, y si entra volumen,
recién ahí tabla `EventQuote` + action + service. El mínimo de 5 pizzas es una
constante en el componente, no un campo de `Settings`; cambiarlo hoy pide deploy.

**Sin verificar.** tsc, lint y build limpios, y la sección se ve en el HTML
servido por 3006. Falta mirarla en browser a 360/768/1280, en claro y oscuro, y
recorrerla con teclado.

## Infraestructura dev

Postgres Docker `co-pg`, puerto **5435** (5432-5434 ocupados por otros
proyectos). `npm run dev` / `build` / `npx prisma studio` funcionan.

**Producción en esta misma máquina:** pm2, app `casaorigen`,
`npm start -- -p 3006`, cwd `/var/www/casa-origen`. Desplegar con
`pm2 stop casaorigen && rm -rf .next && npm run build && pm2 start casaorigen`
— el build no puede correr con `next start` vivo, le pisa `.next/`.

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
