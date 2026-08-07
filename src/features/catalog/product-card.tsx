'use client';

import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ProductDetail } from '@/server/repositories/product.repository';
import { useCartStore } from '@/features/cart/cart-store';

type SizeOptions = ProductDetail['variantGroups'][number]['options'];

/**
 * Biggest size the kitchen can actually make: the highest `priceDelta` among
 * the available options. Falls back to the first available one when every
 * delta is the same, and to nothing when the group is sold out.
 */
function largestAvailableOption(options: SizeOptions | undefined) {
  if (!options) return undefined;

  let best: SizeOptions[number] | undefined;
  for (const option of options) {
    if (!option.isAvailable) continue;
    if (!best || option.priceDelta > best.priceDelta) best = option;
  }
  return best;
}

export function ProductCard({ product }: { product: ProductDetail }) {
  const addLine = useCartStore((state) => state.addLine);
  const isUnavailable = product.availability !== 'AVAILABLE';
  const sizeGroup = product.variantGroups[0];

  // Deliberately not `isDefault`, which marks the smallest size: the card opens
  // on the biggest available one, so the button suggests the family pizza and
  // sizing down is one tap away instead of sizing up.
  const [selectedOptionId, setSelectedOptionId] = useState(
    () => largestAvailableOption(sizeGroup?.options)?.id,
  );
  const selectedOption = sizeGroup?.options.find((option) => option.id === selectedOptionId);

  const [extrasOpen, setExtrasOpen] = useState(false);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  const availableExtras = product.extras.filter((entry) => entry.extra.isActive);

  /** Mirrors `pricing.service`: the chosen size sets the add-on price. */
  function extraUnitPrice(entry: (typeof availableExtras)[number]) {
    return selectedOption?.extraPrice ?? entry.priceOverride ?? entry.extra.price;
  }

  const chosenExtras = availableExtras.filter((entry) => selectedExtraIds.includes(entry.extraId));

  const basePrice = product.offerPrice ?? product.price;
  const hasOffer = product.offerPrice !== null && product.offerPrice < product.price;
  const extrasTotal = chosenExtras.reduce((sum, entry) => sum + extraUnitPrice(entry), 0);
  const effectivePrice = basePrice + (selectedOption?.priceDelta ?? 0) + extrasTotal;

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((current) =>
      current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId],
    );
  }

  function handleAdd() {
    addLine({
      productId: product.id,
      name: product.name,
      image: product.image,
      basePrice,
      quantity: 1,
      variants:
        sizeGroup && selectedOption
          ? [
              {
                groupId: sizeGroup.id,
                optionId: selectedOption.id,
                optionName: selectedOption.name,
                priceDelta: selectedOption.priceDelta,
                extraPrice: selectedOption.extraPrice,
              },
            ]
          : [],
      extras: chosenExtras.map((entry) => ({
        extraId: entry.extraId,
        name: entry.extra.name,
        unitPrice: extraUnitPrice(entry),
        quantity: 1,
      })),
      removedIngredientIds: [],
      removedIngredientNames: [],
    });
    // The card is reused for the next order of the same pizza; leaving the
    // add-ons ticked would silently price the second one like the first.
    setSelectedExtraIds([]);
    setExtrasOpen(false);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group border-border bg-card relative flex flex-col overflow-hidden rounded-2xl border"
    >
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
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
            {product.tags.slice(0, 2).map(({ tag }) => (
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
        <h3 className="font-display line-clamp-1 text-base font-semibold">{product.name}</h3>
        {product.shortDescription && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{product.shortDescription}</p>
        )}

        {/* Every size with its own price: comparing them is the actual
            decision, and hiding all but the selected one forced a tap per size
            just to find out what the big one costs. */}
        {sizeGroup && sizeGroup.options.length > 0 && (
          <div role="group" aria-label={sizeGroup.name} className="mt-1 flex flex-col gap-1.5">
            {sizeGroup.options.map((option) => {
              const isSelected = option.id === selectedOptionId;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={!option.isAvailable}
                  title={option.isAvailable ? undefined : 'Tamaño no disponible'}
                  onClick={() => setSelectedOptionId(option.id)}
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
        )}

        {/* Collapsed by default: eleven add-ons open on every card would push
            the buy button off the screen on a phone, and most orders are the
            pizza as it comes. The count keeps the choice visible once closed. */}
        {availableExtras.length > 0 && (
          <div className="mt-1">
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
                {availableExtras.map((entry) => {
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
                      {entry.extra.name}
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

        <div className="mt-auto pt-3">
          {hasOffer && (
            <p className="text-muted-foreground mb-1 text-xs">
              Antes{' '}
              <span className="line-through">
                {formatMoney(product.price + (selectedOption?.priceDelta ?? 0) + extrasTotal)}
              </span>
            </p>
          )}
          {/* The price rides the button: one target, and it says what the tap
              will cost with the size already chosen. */}
          <Button
            // Wraps instead of clipping: icon + label + price is wider than a
            // card in the 2-column phone grid, and `whitespace-nowrap` +
            // `justify-center` used to bleed the plus off the left edge and
            // the price off the right.
            className="h-auto w-full flex-wrap gap-x-2 gap-y-0.5 px-3 py-2 text-xs sm:text-sm"
            disabled={isUnavailable}
            onClick={handleAdd}
            aria-label={
              isUnavailable
                ? `${product.name} agotado`
                : `Agregar ${product.name}${selectedOption ? ` ${selectedOption.name}` : ''} al carrito por ${formatMoney(effectivePrice)}`
            }
          >
            {isUnavailable ? (
              'Agotado'
            ) : (
              <>
                <Plus className="hidden size-4 sm:inline-block" aria-hidden />
                <span>Agregar</span>
                <span className="font-bold tabular-nums">{formatMoney(effectivePrice)}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
