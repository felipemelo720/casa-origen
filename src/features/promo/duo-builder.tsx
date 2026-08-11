'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Plus, X } from 'lucide-react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ClosedNotice } from '@/components/shared/closed-notice';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/features/cart/cart-store';
import type { DuoPromoOption, DuoPromoView } from '@/features/promo/duo-promo-view';
import type { OpenState } from '@/server/services/schedule.service';

const ORDINALS = ['primera', 'segunda', 'tercera', 'cuarta'];

/** "Elige la segunda" reads like a person; "Pizza 2 de 2" reads like a form. */
function slotHeading(filled: number, total: number): string {
  const ordinal = ORDINALS[filled];
  if (filled >= total) return 'Tu dúo está listo';
  return ordinal ? `Elige la ${ordinal}` : `Elige la pizza ${filled + 1}`;
}

export function DuoBuilder({
  promo,
  open,
  onOpenChange,
  openState,
}: {
  promo: DuoPromoView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openState: OpenState;
}) {
  const addLine = useCartStore((state) => state.addLine);
  const reduceMotion = useReducedMotion();

  const [picks, setPicks] = useState<DuoPromoOption[]>([]);
  const [drinkIds, setDrinkIds] = useState<string[]>([]);

  const complete = picks.length === promo.bundleSize;

  const { regular, drinksTotal, total, savings } = useMemo(() => {
    // Before the bundle is complete there is nothing real to anchor against,
    // so the card's "desde" figure stands in. Once it is complete the anchor
    // becomes what these exact pizzas would have cost — the number gets more
    // honest, and better, as the customer picks.
    const regularPrice = complete
      ? picks.reduce((sum, pick) => sum + pick.unitPrice, 0)
      : promo.regularFrom;
    const drinks = promo.drinks
      .filter((drink) => drinkIds.includes(drink.productId))
      .reduce((sum, drink) => sum + drink.price, 0);
    return {
      regular: regularPrice,
      drinksTotal: drinks,
      total: promo.bundlePrice + drinks,
      savings: Math.max(0, regularPrice - promo.bundlePrice),
    };
  }, [complete, picks, drinkIds, promo]);

  function pick(option: DuoPromoOption) {
    if (!option.available || complete) return;
    setPicks((current) => [...current, option]);
  }

  function unpick(index: number) {
    setPicks((current) => current.filter((_, position) => position !== index));
  }

  function toggleDrink(productId: string) {
    setDrinkIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function addToCart() {
    if (!complete || !openState.isOpen) return;

    // Two ordinary pizza lines, never one opaque "Promo Dúo" item: the customer
    // can still edit each one, the kitchen ticket reads two pizzas, and the
    // discount comes from `pricing.service` recognising the pair.
    for (const option of picks) {
      addLine({
        productId: option.productId,
        name: option.name,
        image: option.image,
        basePrice: option.basePrice,
        quantity: 1,
        variants: [
          {
            groupId: option.groupId,
            optionId: option.optionId,
            optionName: option.optionName,
            priceDelta: option.priceDelta,
            extraPrice: option.extraPrice,
            extraPremiumPrice: option.extraPremiumPrice,
          },
        ],
        extras: [],
        removedIngredientIds: [],
        removedIngredientNames: [],
      });
    }

    for (const drink of promo.drinks.filter((d) => drinkIds.includes(d.productId))) {
      addLine({
        productId: drink.productId,
        name: drink.name,
        image: drink.image,
        basePrice: drink.price,
        quantity: 1,
        variants: [],
        extras: [],
        removedIngredientIds: [],
        removedIngredientNames: [],
      });
    }

    setPicks([]);
    setDrinkIds([]);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // El cierre propio y no el de `SheetContent`: el de la primitiva es un
        // icono de 16px sobre la foto de la cabecera — queda bajo el objetivo
        // táctil de 44px y sin contraste garantizado contra la imagen.
        showCloseButton={false}
        className="flex max-h-[92svh] flex-col gap-0 rounded-t-2xl p-0 sm:mx-auto sm:max-w-2xl"
      >
        {/* ---- Cabecera con foto ---- */}
        <div className="relative h-32 shrink-0 overflow-hidden rounded-t-2xl sm:h-40">
          {promo.image && (
            <Image
              src={promo.image}
              alt=""
              fill
              sizes="(min-width: 640px) 42rem, 100vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <SheetTitle className="font-display text-2xl font-bold text-white">
              {promo.name}
            </SheetTitle>
            <p className="text-sm text-white/85">
              {promo.bundleSize} pizzas de {promo.sizeLabel} · {formatMoney(promo.bundlePrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="focus-visible:ring-ring absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* ---- Ranuras ---- */}
        <div className="bg-card border-border flex shrink-0 gap-3 border-b px-4 py-3">
          {Array.from({ length: promo.bundleSize }, (_, index) => {
            const filled = picks[index];
            return filled ? (
              <motion.button
                key={`slot-${index}`}
                type="button"
                initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                onClick={() => unpick(index)}
                className="border-border bg-background focus-visible:ring-ring group relative flex min-h-11 flex-1 items-center gap-2 overflow-hidden rounded-xl border p-1.5 text-left focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-lg">
                  {filled.image && (
                    <Image src={filled.image} alt="" fill sizes="40px" className="object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{filled.name}</span>
                  <span className="text-muted-foreground text-xs underline">Cambiar</span>
                </span>
              </motion.button>
            ) : (
              <div
                key={`slot-${index}`}
                className={cn(
                  'border-border text-muted-foreground flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-dashed p-1.5',
                  index === picks.length && 'border-primary text-primary',
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center">
                  <Plus className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-medium">Pizza {index + 1}</span>
              </div>
            );
          })}
        </div>

        {/* ---- Grilla ---- */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <h3 className="mb-3 text-sm font-semibold" aria-live="polite">
            {slotHeading(picks.length, promo.bundleSize)}
          </h3>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {promo.options.map((option) => {
              const timesPicked = picks.filter((p) => p.optionId === option.optionId).length;
              const disabled = !option.available || complete;
              return (
                <li key={option.optionId}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(option)}
                    aria-label={`Elegir ${option.name}`}
                    className={cn(
                      'border-border bg-card focus-visible:ring-ring relative w-full overflow-hidden rounded-xl border text-left transition-opacity focus-visible:ring-2 focus-visible:outline-none',
                      disabled && 'opacity-45',
                      timesPicked > 0 && 'border-primary opacity-100',
                    )}
                  >
                    <span className="bg-muted relative block aspect-[4/3] w-full">
                      {option.image && (
                        <Image
                          src={option.image}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 13rem, 45vw"
                          className="object-cover"
                        />
                      )}
                      {timesPicked > 0 && (
                        <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full text-xs font-bold">
                          {timesPicked > 1 ? `×${timesPicked}` : <Check className="size-3.5" />}
                        </span>
                      )}
                      {!option.available && (
                        <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-semibold text-white">
                          No disponible
                        </span>
                      )}
                    </span>
                    <span className="block px-2 py-2">
                      <span className="block truncate text-sm font-semibold">{option.name}</span>
                      {option.shortDescription && (
                        <span className="text-muted-foreground line-clamp-2 text-xs">
                          {option.shortDescription}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---- Pie ---- */}
        <div className="bg-card border-border shrink-0 space-y-3 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Las bebidas aparecen recién con el dúo armado: antes competirían
              con la única decisión que importa, y el total dejaría de coincidir
              con el número grande de la cabecera mientras elige. */}
          <AnimatePresence initial={false}>
            {complete && promo.drinks.length > 0 && (
              <motion.div
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-muted-foreground mb-2 text-xs font-medium">¿Le sumas bebida?</p>
                <div className="flex flex-wrap gap-2">
                  {promo.drinks.map((drink) => {
                    const picked = drinkIds.includes(drink.productId);
                    return (
                      <button
                        key={drink.productId}
                        type="button"
                        aria-pressed={picked}
                        onClick={() => toggleDrink(drink.productId)}
                        className={cn(
                          'border-border focus-visible:ring-ring flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                          picked
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'hover:bg-accent text-foreground',
                        )}
                      >
                        {picked ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <Plus className="size-4" aria-hidden />
                        )}
                        {drink.name}
                        <span className="text-muted-foreground">+{formatMoney(drink.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!openState.isOpen && <ClosedNotice>{openState.reason}</ClosedNotice>}

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs">
                <span className="line-through">{formatMoney(regular + drinksTotal)}</span>
                {savings > 0 && (
                  <span className="text-success ml-1.5 font-semibold">
                    ahorras {formatMoney(savings)}
                  </span>
                )}
              </p>
              <p className="text-xl font-bold">{formatMoney(total)}</p>
            </div>
            <Button
              type="button"
              size="lg"
              disabled={!complete || !openState.isOpen}
              onClick={addToCart}
              className="min-h-11"
            >
              {complete ? 'Agregar al carrito' : slotHeading(picks.length, promo.bundleSize)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
