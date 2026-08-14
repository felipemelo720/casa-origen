'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { productPath } from '@/features/catalog/product-path';
import type { ProductView } from '@/features/catalog/product-view';
import { useProductSelection } from '@/features/catalog/use-product-selection';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export function ProductCard({ product }: { product: ProductView }) {
  const {
    selection,
    selectOption,
    selectedExtraIds,
    toggleExtra,
    extraUnitPrice,
    chosenExtras,
    basePrice,
    hasOffer,
    unitPrice,
    regularUnitPrice,
    missingGroups,
    canAdd,
    addToCart,
  } = useProductSelection(product);

  const [extrasOpen, setExtrasOpen] = useState(false);
  const isUnavailable = !product.isAvailable;
  const href = productPath(product.slug);

  /*
   * Sólo las escaleras de precio (dos opciones que cuestan distinto) se dibujan
   * en la tarjeta. Un grupo de sabor —el que tiene el Combo Individual— exige
   * una decisión por grupo y no cabe en una card de dos columnas: ahí el botón
   * pasa a ser un enlace a la ficha, que es donde sí cabe.
   */
  const ladderGroups = product.groups.filter(
    (group) => new Set(group.options.map((option) => option.priceDelta)).size > 1,
  );
  const needsFicha = missingGroups.length > 0;

  /*
   * La entrada es CSS (`reveal`, ver `globals.css`) y no framer-motion.
   *
   * Con `motion.article` + `initial={{ opacity: 0 }}` el servidor mandaba la
   * card con `style="opacity:0"` y lo único que la volvía visible era
   * framer-motion hidratando y un `IntersectionObserver` disparando. Cuando eso
   * no pasaba, la carta entera —el camino de conversión— quedaba transparente
   * sobre una página que se veía sana. `reveal` no depende de que corra JS, y
   * donde el navegador no soporta la timeline de scroll la regla no existe:
   * la card sale visible, sin animación.
   *
   * Antes era `animate-fade-up`, que disparaba al pintar: las cards de abajo
   * animaban fuera de pantalla y llegaban quietas. El escalonado ahora lo da
   * la posición real de cada card, sin un `animation-delay` por índice.
   */
  return (
    <article className="group border-border bg-card reveal relative flex flex-col overflow-hidden rounded-2xl border">
      <div className="bg-muted relative aspect-square overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={cn(
              'object-cover transition-transform duration-500 group-hover:scale-105',
              isUnavailable && 'grayscale',
            )}
          />
        ) : null}

        {isUnavailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Badge variant="secondary">Agotado</Badge>
          </div>
        )}

        {product.tags.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                className="border-none text-[10px]"
                style={{ backgroundColor: tag.color, color: 'white' }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display line-clamp-1 text-base font-semibold">
          {/* Un solo enlace por tarjeta, estirado con `after:inset-0` sobre toda
              la card: la foto abre la ficha sin agregar un segundo tab stop ni
              un link sin nombre accesible. Los controles que vienen después en
              el DOM van `relative`, así que quedan por encima del overlay y el
              camino corto al carrito no se pierde. */}
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:underline focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        {product.shortDescription && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{product.shortDescription}</p>
        )}

        {/* Every size with its own price: comparing them is the actual
            decision, and hiding all but the selected one forced a tap per size
            just to find out what the big one costs. */}
        {ladderGroups.map((group) => (
          <div
            key={group.id}
            role="group"
            aria-label={group.name}
            className="relative mt-1 flex flex-col gap-1.5"
          >
            {group.options.map((option) => {
              const isSelected = option.id === selection[group.id];
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={!option.isAvailable}
                  title={option.isAvailable ? undefined : 'Tamaño no disponible'}
                  onClick={() => selectOption(group.id, option.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background hover:border-primary',
                  )}
                >
                  <span className={cn('truncate', isSelected && 'font-semibold')}>
                    {option.name}
                  </span>
                  <span className={cn('shrink-0 tabular-nums', isSelected && 'font-bold')}>
                    {formatMoney(basePrice + option.priceDelta)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {/* Collapsed by default: eleven add-ons open on every card would push
            the buy button off the screen on a phone, and most orders are the
            pizza as it comes. The count keeps the choice visible once closed. */}
        {!needsFicha && product.extras.length > 0 && (
          <div className="relative mt-1">
            <button
              type="button"
              onClick={() => setExtrasOpen((open) => !open)}
              aria-expanded={extrasOpen}
              className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-xs transition-colors"
            >
              <span>
                Agregados
                {chosenExtras.length > 0 && (
                  <span className="text-primary font-semibold"> · {chosenExtras.length}</span>
                )}
              </span>
              <ChevronDown
                className={cn('size-4 shrink-0 transition-transform', extrasOpen && 'rotate-180')}
                aria-hidden
              />
            </button>

            {extrasOpen && (
              <div role="group" aria-label="Agregados" className="flex flex-wrap gap-1.5 pt-1">
                {product.extras.map((entry) => {
                  const isSelected = selectedExtraIds.includes(entry.extraId);
                  return (
                    <button
                      key={entry.extraId}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleExtra(entry.extraId)}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-xs transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 font-semibold'
                          : 'border-border bg-background hover:border-primary',
                      )}
                    >
                      {entry.name}
                      <span className="text-muted-foreground ml-1 tabular-nums">
                        +{formatMoney(extraUnitPrice(entry))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="relative mt-auto pt-3">
          {hasOffer && !needsFicha && (
            <p className="text-muted-foreground mb-1 text-xs">
              Antes <span className="line-through">{formatMoney(regularUnitPrice)}</span>
            </p>
          )}
          {/* The price rides the button: one target, and it says what the tap
              will cost with the size already chosen. */}
          {needsFicha && !isUnavailable ? (
            <Button
              asChild
              className="h-auto w-full flex-wrap gap-x-2 gap-y-0.5 px-3 py-2 text-xs sm:text-sm"
            >
              <Link href={href}>Elegir opciones</Link>
            </Button>
          ) : (
            <Button
              // Wraps instead of clipping: icon + label + price is wider than a
              // card in the 2-column phone grid, and `whitespace-nowrap` +
              // `justify-center` used to bleed the plus off the left edge and
              // the price off the right.
              className="h-auto w-full flex-wrap gap-x-2 gap-y-0.5 px-3 py-2 text-xs sm:text-sm"
              disabled={!canAdd}
              onClick={addToCart}
              aria-label={
                isUnavailable
                  ? `${product.name} agotado`
                  : `Agregar ${product.name} al carrito por ${formatMoney(unitPrice)}`
              }
            >
              {isUnavailable ? (
                'Agotado'
              ) : (
                <>
                  <Plus className="hidden size-4 sm:inline-block" aria-hidden />
                  <span>Agregar</span>
                  <span className="font-bold tabular-nums">{formatMoney(unitPrice)}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
