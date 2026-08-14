'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useReducedMotion, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ClosedNotice } from '@/components/shared/closed-notice';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/features/cart/cart-store';
import {
  comboTotal,
  type ComboPromoChoice,
  type ComboPromoView,
} from '@/features/promo/combo-promo-view';
import type { OpenState } from '@/server/services/schedule.service';

export function ComboBuilder({
  promo,
  open,
  onOpenChange,
  openState,
}: {
  promo: ComboPromoView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openState: OpenState;
}) {
  const addLine = useCartStore((state) => state.addLine);
  const reduceMotion = useReducedMotion();

  // Una elección por grupo, indexada por `groupId`. Arranca vacío a propósito:
  // preseleccionar la primera opción haría que el combo se pudiera agregar sin
  // que nadie eligiera nada, y el cliente descubriría el sabor en la boleta.
  const [picked, setPicked] = useState<Record<string, ComboPromoChoice>>({});

  const chosen = useMemo(
    () => promo.groups.map((group) => picked[group.groupId]).filter((c) => c !== undefined),
    [promo.groups, picked],
  );

  const complete = chosen.length === promo.groups.length;
  const total = comboTotal(promo, chosen);
  const savings = Math.max(0, promo.regularPrice - promo.price);

  // El primer grupo sin resolver: es lo que el pie anuncia como próximo paso.
  const pendingGroup = promo.groups.find((group) => !picked[group.groupId]);

  function choose(groupId: string, choice: ComboPromoChoice) {
    if (!choice.available) return;
    setPicked((current) => ({ ...current, [groupId]: choice }));
  }

  function addToCart() {
    if (!complete || !openState.isOpen) return;

    // Una sola línea con sus dos variantes, no una pizza suelta más una bebida
    // suelta: el combo es un producto con precio propio, y separarlo lo cobraría
    // a precio de carta. `pricing.service` recalcula igual desde el `productId`
    // y los ids de opción — acá sólo viaja la selección.
    addLine({
      productId: promo.productId,
      name: promo.name,
      image: promo.image,
      basePrice: promo.price,
      quantity: 1,
      variants: promo.groups.map((group) => {
        const choice = picked[group.groupId];
        return {
          groupId: group.groupId,
          optionId: choice?.optionId ?? '',
          optionName: choice?.name ?? '',
          priceDelta: choice?.priceDelta ?? 0,
          extraPrice: null,
          extraPremiumPrice: null,
        };
      }),
      extras: [],
      removedIngredientIds: [],
      removedIngredientNames: [],
    });

    setPicked({});
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // El cierre propio y no el de `SheetContent`, por lo mismo que el dúo:
        // el de la primitiva es un icono de 16px sobre la foto, bajo el objetivo
        // táctil de 44px y sin contraste garantizado.
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
            <p className="text-sm text-white/85">{formatMoney(promo.price)} · precio cerrado</p>
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

        {/* ---- Un bloque por decisión ---- */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {promo.groups.map((group) => {
            const selected = picked[group.groupId];
            return (
              <fieldset key={group.groupId} className="min-w-0">
                <legend className="mb-3 flex w-full items-center gap-2 text-sm font-semibold">
                  {group.name}
                  {selected && (
                    <motion.span
                      initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    >
                      <Check className="size-3" aria-hidden />
                      {selected.name}
                    </motion.span>
                  )}
                </legend>

                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {group.choices.map((choice) => {
                    const isPicked = selected?.optionId === choice.optionId;
                    return (
                      <li key={choice.optionId}>
                        <button
                          type="button"
                          disabled={!choice.available}
                          // `aria-pressed` y no un radio nativo: el control es
                          // una tarjeta con foto, y un `input` escondido detrás
                          // dejaba el foco en un elemento invisible.
                          aria-pressed={isPicked}
                          onClick={() => choose(group.groupId, choice)}
                          className={cn(
                            'border-border bg-card focus-visible:ring-ring relative w-full overflow-hidden rounded-xl border text-left transition-opacity focus-visible:ring-2 focus-visible:outline-none',
                            !choice.available && 'opacity-45',
                            isPicked && 'border-primary opacity-100',
                          )}
                        >
                          <span className="bg-muted relative block aspect-[4/3] w-full">
                            {choice.image && (
                              <Image
                                src={choice.image}
                                alt=""
                                fill
                                sizes="(min-width: 640px) 13rem, 45vw"
                                className="object-cover"
                              />
                            )}
                            {isPicked && (
                              <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full">
                                <Check className="size-3.5" aria-hidden />
                              </span>
                            )}
                            {!choice.available && (
                              <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-semibold text-white">
                                No disponible
                              </span>
                            )}
                          </span>
                          <span className="block px-2 py-2">
                            <span className="block truncate text-sm font-semibold">
                              {choice.name}
                            </span>
                            {choice.shortDescription && (
                              <span className="text-muted-foreground line-clamp-2 text-xs">
                                {choice.shortDescription}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>

        {/* ---- Pie ---- */}
        <div className="bg-card border-border shrink-0 space-y-3 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!openState.isOpen && <ClosedNotice>{openState.reason}</ClosedNotice>}

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs">
                {savings > 0 && (
                  <>
                    <span className="line-through">{formatMoney(promo.regularPrice)}</span>
                    <span className="text-success ml-1.5 font-semibold">
                      ahorras {formatMoney(savings)}
                    </span>
                  </>
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
              {complete ? 'Agregar al carrito' : (pendingGroup?.name ?? 'Elige tus opciones')}
            </Button>
          </div>
          {/* Anunciado aparte del botón: su etiqueta cambia mientras elige, y un
              `aria-live` sobre el propio botón repetiría el texto del foco. */}
          <p className="sr-only" aria-live="polite">
            {complete
              ? `Combo listo, ${formatMoney(total)}`
              : `Falta elegir: ${pendingGroup?.name ?? ''}`}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
