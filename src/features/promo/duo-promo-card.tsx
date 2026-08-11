import { DuoPromoCta } from '@/features/promo/duo-promo-cta';
import type { DuoPromoView } from '@/features/promo/duo-promo-view';
import { formatMoney } from '@/lib/money';
import type { OpenState } from '@/server/services/schedule.service';

/**
 * La oferta, arriba del menú y debajo de la barra de confianza.
 *
 * Va antes de "Los más pedidos" a propósito: es el único bloque de la landing
 * que baja el precio de un pedido completo, así que gana el lugar contra una
 * lista de productos sueltos. El costo asumido es que la carta arranca ~200px
 * más abajo en móvil.
 *
 * **Sin foto de fondo.** La tuvo, y competía con lo único que este bloque tiene
 * que comunicar: un precio. Una pizza detrás del texto obliga a un velo cada
 * vez más oscuro para que el número llegue a 4.5:1, y termina siendo una foto
 * que no se ve bajo un texto que igual cuesta leer. El peso lo carga el color:
 * es el único bloque de la landing pintado con el acento completo, así que
 * domina la pantalla sin pelearle a nada. Las fotos de verdad —las siete
 * pizzas— están en el armador, donde sí deciden algo.
 *
 * Server component: sólo el botón es cliente, y el armador se descarga recién
 * cuando alguien lo toca.
 */
export function DuoPromoCard({ promo, openState }: { promo: DuoPromoView; openState: OpenState }) {
  const savings = Math.max(0, promo.regularFrom - promo.bundlePrice);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
      <div className="bg-primary text-primary-foreground rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          {/* ---- Qué es ---- */}
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.12em] uppercase opacity-80">Oferta</p>
            <h2 className="font-display mt-1 text-3xl font-bold sm:text-4xl">{promo.name}</h2>
            <p className="mt-1 max-w-prose text-sm opacity-90 sm:text-base">
              {promo.description ??
                `${promo.bundleSize} pizzas de ${promo.sizeLabel} por un solo precio.`}
            </p>
          </div>

          {/* ---- Cuánto sale y cómo se pide ----
              Juntos y alineados a la derecha en escritorio: el precio y el
              botón son la misma decisión, y mandarlos a esquinas opuestas del
              bloque obliga a cruzar la tarjeta con la vista. */}
          <div className="shrink-0 sm:text-right">
            <p className="flex flex-wrap items-baseline gap-x-3 sm:justify-end">
              {/* "desde": el ancla es el par más barato de la carta, no
                  cualquier par. El armador lo reemplaza por el precio real de
                  las pizzas elegidas apenas el dúo está completo. */}
              {savings > 0 && (
                <span className="text-sm line-through opacity-70">
                  desde {formatMoney(promo.regularFrom)}
                </span>
              )}
              <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                {formatMoney(promo.bundlePrice)}
              </span>
            </p>

            {savings > 0 && (
              // Píldora invertida y no `text-success`: el verde de éxito está
              // calibrado contra `--background`, y sobre el acento pierde el
              // contraste. Invertir el par de tokens lo mantiene en los dos
              // temas sin introducir un color nuevo.
              <p className="mt-2 sm:flex sm:justify-end">
                <span className="bg-primary-foreground text-primary inline-block rounded-full px-2.5 py-1 text-xs font-semibold">
                  Ahorras {formatMoney(savings)}
                </span>
              </p>
            )}

            <div className="mt-4 sm:flex sm:justify-end">
              <DuoPromoCta promo={promo} openState={openState} />
            </div>

            <p className="mt-3 text-xs opacity-80">Envíos y retiros · Elige tus dos sabores</p>
          </div>
        </div>
      </div>
    </section>
  );
}
