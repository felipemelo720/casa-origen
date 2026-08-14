import { ComboPromoCta } from '@/features/promo/combo-promo-cta';
import type { ComboPromoView } from '@/features/promo/combo-promo-view';
import { formatMoney } from '@/lib/money';
import type { OpenState } from '@/server/services/schedule.service';

/**
 * La segunda oferta, pegada a la Promo Dúo.
 *
 * Misma anatomía y mismo peso visual que `DuoPromoCard` por pedido explícito:
 * etiqueta, título, bajada, ancla tachada, precio grande, píldora de ahorro,
 * CTA y línea de servicio, sobre el acento completo.
 *
 * **El costo asumido**: dos bloques `bg-primary` seguidos son dos elementos
 * dominantes, y el acento deja de significar "esto es *la* oferta". La Dúo
 * queda primera porque baja más el precio de un pedido completo.
 *
 * Server component: sólo el botón es cliente, y el armador se descarga recién
 * cuando alguien lo toca.
 */
export function ComboPromoCard({
  promo,
  openState,
}: {
  promo: ComboPromoView;
  openState: OpenState;
}) {
  const savings = Math.max(0, promo.regularPrice - promo.price);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="bg-primary text-primary-foreground rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          {/* ---- Qué es ---- */}
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.12em] uppercase opacity-80">Oferta</p>
            <h2 className="font-display mt-1 text-3xl font-bold sm:text-4xl">{promo.name}</h2>
            <p className="mt-1 max-w-prose text-sm opacity-90 sm:text-base">
              {promo.description ?? 'Una pizza y una bebida por un solo precio.'}
            </p>
          </div>

          {/* ---- Cuánto sale y cómo se pide ---- */}
          <div className="shrink-0 sm:text-right">
            <p className="flex flex-wrap items-baseline gap-x-3 sm:justify-end">
              {/* Sin "desde": a diferencia del dúo el precio no depende de qué
                  elija, así que el ancla es exacta y no un piso. */}
              {savings > 0 && (
                <span className="text-sm line-through opacity-70">
                  {formatMoney(promo.regularPrice)}
                </span>
              )}
              <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                {formatMoney(promo.price)}
              </span>
            </p>

            {savings > 0 && (
              // Mismo par invertido que la Dúo: `text-success` está calibrado
              // contra `--background` y sobre el acento pierde contraste.
              <p className="mt-2 sm:flex sm:justify-end">
                <span className="bg-primary-foreground text-primary inline-block rounded-full px-2.5 py-1 text-xs font-semibold">
                  Ahorras {formatMoney(savings)}
                </span>
              </p>
            )}

            <div className="mt-4 sm:flex sm:justify-end">
              <ComboPromoCta promo={promo} openState={openState} />
            </div>

            <p className="mt-3 text-xs opacity-80">Envíos y retiros · Elige sabor y bebida</p>
          </div>
        </div>
      </div>
    </section>
  );
}
