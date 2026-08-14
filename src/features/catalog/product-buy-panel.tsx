'use client';

import { Minus, Plus, ShoppingBag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ProductDetailView, ProductViewGroup } from '@/features/catalog/product-view';
import { useProductSelection } from '@/features/catalog/use-product-selection';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/** Un grupo con dos precios distintos es una escalera de tamaño; si no, es sabor. */
function isPriceLadder(group: ProductViewGroup): boolean {
  return new Set(group.options.map((option) => option.priceDelta)).size > 1;
}

/**
 * El panel de compra de la ficha.
 *
 * Es lo único cliente de la página: el resto —galería estática, descripción,
 * ingredientes, relacionados— es server component. Comparte
 * `useProductSelection` con la tarjeta de la grilla, así que el número que
 * imprime acá y el que imprime allá no pueden separarse.
 */
export function ProductBuyPanel({ product }: { product: ProductDetailView }) {
  const {
    selection,
    selectOption,
    selectedExtraIds,
    toggleExtra,
    extraUnitPrice,
    chosenExtras,
    quantity,
    setQuantity,
    basePrice,
    hasOffer,
    unitPrice,
    regularUnitPrice,
    missingGroups,
    canAdd,
    addToCart,
  } = useProductSelection(product);

  const lineTotal = unitPrice * quantity;

  return (
    <div className="flex flex-col gap-6">
      {product.groups.map((group) => {
        const ladder = isPriceLadder(group);
        return (
          <fieldset key={group.id}>
            <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
              <span>{group.name}</span>
              {group.isRequired && (
                <span className="text-muted-foreground text-xs font-normal">Obligatorio</span>
              )}
            </legend>

            <div role="group" aria-label={group.name} className="flex flex-col gap-2">
              {group.options.map((option) => {
                const isSelected = option.id === selection[group.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={!option.isAvailable}
                    onClick={() => selectOption(group.id, option.id)}
                    className={cn(
                      // 44px de alto: es el control que más se toca de la ficha.
                      'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background hover:border-primary',
                    )}
                  >
                    <span className={cn('truncate text-left', isSelected && 'font-semibold')}>
                      {option.name}
                      {!option.isAvailable && (
                        <span className="text-muted-foreground ml-2 text-xs">No disponible</span>
                      )}
                    </span>
                    {/* Sólo las escaleras muestran cifra: en un grupo de sabor
                        todas cuestan lo mismo y repetir el precio siete veces
                        no informa nada. */}
                    {ladder && (
                      <span className={cn('shrink-0 tabular-nums', isSelected && 'font-bold')}>
                        {formatMoney(basePrice + option.priceDelta)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {/* Abiertos, a diferencia de la tarjeta: acá hay ancho de sobra y ver los
          agregados es media razón para entrar a la ficha. */}
      {product.extras.length > 0 && (
        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
            <span>Agregados</span>
            <span className="text-muted-foreground text-xs font-normal">
              {chosenExtras.length > 0 ? `${chosenExtras.length} elegidos` : 'Opcional'}
            </span>
          </legend>

          <div role="group" aria-label="Agregados" className="flex flex-wrap gap-2">
            {product.extras.map((entry) => {
              const isSelected = selectedExtraIds.includes(entry.extraId);
              return (
                <button
                  key={entry.extraId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleExtra(entry.extraId)}
                  className={cn(
                    'min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 font-semibold'
                      : 'border-border bg-background hover:border-primary',
                  )}
                >
                  {entry.name}
                  <span className="text-muted-foreground ml-1.5 tabular-nums">
                    +{formatMoney(extraUnitPrice(entry))}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="border-border flex flex-col gap-3 border-t pt-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1" role="group" aria-label="Cantidad">
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label="Quitar una unidad"
            >
              <Minus className="size-4" aria-hidden />
            </Button>
            {/* `aria-live` acá y no en el total: la cantidad es lo único que
                cambia sin que el foco se mueva al control que lo cambió. */}
            <span
              className="w-10 text-center text-base font-semibold tabular-nums"
              aria-live="polite"
            >
              {quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              onClick={() => setQuantity(Math.min(20, quantity + 1))}
              disabled={quantity >= 20}
              aria-label="Agregar una unidad"
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="text-right">
            {hasOffer && (
              <p className="text-muted-foreground text-xs">
                Antes{' '}
                <span className="tabular-nums line-through">
                  {formatMoney(regularUnitPrice * quantity)}
                </span>
              </p>
            )}
            <p className="font-display text-2xl font-bold tabular-nums">{formatMoney(lineTotal)}</p>
          </div>
        </div>

        {/* El estado deshabilitado explica el motivo en el mismo lugar donde
            molesta, en vez de dejar un botón muerto sin razón. */}
        {!product.isAvailable ? (
          <>
            <Button size="lg" className="h-12 w-full" disabled>
              Agotado
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Se nos acabó por ahora. Vuelve a mirar más tarde o elige otra de la carta.
            </p>
          </>
        ) : (
          <>
            <Button
              size="lg"
              className="h-12 w-full gap-2"
              disabled={!canAdd}
              onClick={addToCart}
              aria-label={`Agregar ${quantity} × ${product.name} al carrito por ${formatMoney(lineTotal)}`}
            >
              <ShoppingBag className="size-4" aria-hidden />
              Agregar al carrito
            </Button>
            {missingGroups.length > 0 && (
              <p className="text-muted-foreground text-center text-xs">
                Falta elegir {missingGroups.map((group) => group.name).join(' y ')}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
