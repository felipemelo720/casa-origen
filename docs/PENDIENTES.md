# Pendientes — 2026-08-09

Estado al cierre de la sesión de tests de integración + avisos.

## Bloquea el push

1. **`npm run format`** — `src/features/admin/stat-card.tsx` está sin formatear
   (cambio previo, sin commitear). `format:check` es un step de CI: así como
   está, el push falla y no despliega.
2. **Commit + push** — nada de lo de hoy está commiteado. Nada llega a
   producción sin que `main` avance.

   Trabajo de esta sesión, listo para ir:

   ```
   tests/  vitest.integration.config.ts  .env.test.example
   .github/workflows/ci.yml  scripts/deploy.sh
   package.json  .gitignore  PLAN.md  docs/PENDIENTE*.md
   ```

   Cambios anteriores que ya estaban en el working tree sin commitear —
   **decisión pendiente de Felipe**, no salieron de esta sesión y no están
   verificados en browser:

   ```
   src/app/(admin)/admin/page.tsx            (185 líneas)
   src/components/layout/storefront-header.tsx
   src/features/storefront/event-orders.tsx
   src/features/admin/stat-card.tsx
   src/lib/whatsapp-link.ts
   public/menu/pepperoni.jpg                 (recomprimida)
   ```

   `.env.test` **no** va: está en `.gitignore` y lleva la contraseña del
   Postgres local.

## Telegram (detalle en `docs/PENDIENTE-TELEGRAM.md`)

3. Rotar el token — se pegó en un chat con IA, tratarlo como comprometido.
4. `gh secret set TG_TOKEN`.
5. `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` en `.env.production` del CT
   (`10.10.10.12`, otra máquina).

## Tests que faltan

6. **E2E con Playwright** — trae su propio Chromium, que es justo lo que este CT
   no tiene. Recorrido carrito → checkout → fila en Postgres; admin cierra →
   landing avisa. Viewports 360/768/1280, dark, axe.
7. **Smoke de rutas** — `/`, `/cuenta`, `/admin`, `/api/open-state`,
   `/sitemap.xml`: 200 y cero `console.error`. Es lo que atrapa el
   `[object Event]`.
8. **QA en navegador**, arrastrado de varias sesiones: el paso `'placed'` del
   checkout, `/admin` a 360px, el hero, la sección de eventos. Todo revisado
   solo en HTML servido, nunca en un browser real.

## Deuda de infra (de `PLAN.md`)

9. **PAT clásico** en `/root/.git-credentials`, con alcance sobre toda la cuenta
   y comprometido por el mismo motivo que el token del bot. Cambiar por deploy
   key SSH o token fine-grained.
10. **`.next.prev` fuera de `.gitignore`** — si un deploy muere entre el
    respaldo y la limpieza, ese directorio queda untracked y **todos los deploys
    siguientes mueren** en `working tree is dirty`. Una línea lo arregla.
11. **`TZ=America/Santiago` en el proceso pm2.** El código ya resuelve el día en
    `America/Santiago`, pero el resto de las fechas del server (ventas de
    `/admin`, `createdAt` en `/cuenta`) siguen formateándose en UTC.
12. **Falta probar el rollback con respaldo** (falla del build o del health, con
    `.next.prev` ya creado). Exige tirar el sitio a propósito unos minutos.
13. El deploy tarda ~11 min contra un `TimeoutStartSec=900`. Cuatro de margen.

## Producto / código

14. **`ProductCard` es client y recibe `ProductDetail` entero** — cada producto
    se serializa completo al payload RSC. Falta view model estrecho.
15. **Tokens hardcodeados en `/admin`**: `green-500`, `red-600`, `amber-600`
    violan la regla de `globals.css`, y en dark `text-*-600` queda bajo 4.5:1.
16. **Decidir `freeDeliveryFrom`** — sigue en 35.000, que con la carta nueva son
    cuatro pizzas de 32 cm. Decisión de negocio.
17. **Cuentas**: recuperar contraseña, editar perfil, repetir pedido. Postergado
    a propósito (sin proveedor de email).
18. **Cola de `PLAN.md` desincronizada** — §Infraestructura dev y §Comandos
    todavía dicen `npm run dev` sin `-p` y deploy manual con pm2; `CLAUDE.md` ya
    dice `-p 3010` y deploy por timer.
