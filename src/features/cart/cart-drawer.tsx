'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { resolveExtraPrice, type SizeExtraPricing } from '@/lib/extra-price';
import { formatMoney } from '@/lib/money';
import {
  bundleDiscount,
  unitsToNextBundle,
  type BundleRule,
  type BundleUnit,
} from '@/lib/bundle-promo';
import { cn } from '@/lib/utils';
import { estimateLineTotal, useCartStore, type CartLine } from '@/features/cart/cart-store';
import { MAX_LINE_QUANTITY } from '@/schemas/cart.schema';
import { CheckoutForm, type CheckoutOptions } from '@/features/checkout/checkout-form';
import { QueryProvider } from '@/components/providers/query-provider';

/** One add-on offered for a product, with its catalogue price as the fallback. */
export type CartAddOn = { extraId: string; name: string; price: number; isPremium: boolean };

export type CartDrawerProps = {
  addOnsByProduct: Record<string, CartAddOn[]>;
  /** Add-on prices per size option id, straight from the catalogue. Wins over
   *  the copy the cart line persisted, which can be from an older carta. */
  sizePricingByOption: Record<string, SizeExtraPricing>;
  checkoutOptions: CheckoutOptions;
  /** Featured bundle promotion, so the drawer prints the same discount the
   *  server will charge. `null` when none is running. */
  bundleRule: BundleRule | null;
};

/** "las dos" y no "las 2": la cifra al lado del precio se lee como parte del precio. */
function spellOut(count: number): string {
  return ['cero', 'una', 'dos', 'tres', 'cuatro'][count] ?? String(count);
}

/** One entry per single pizza, mirroring what `pricing.service` feeds the rule. */
function toBundleUnits(lines: CartLine[]): BundleUnit[] {
  return lines.flatMap((line) => {
    const unitPrice = line.basePrice + line.variants.reduce((sum, v) => sum + v.priceDelta, 0);
    const variantNames = line.variants.map((v) => v.optionName);
    return Array.from({ length: line.quantity }, () => ({
      productId: line.productId,
      unitPrice,
      variantNames,
    }));
  });
}

export function CartDrawer({
  addOnsByProduct,
  sizePricingByOption,
  checkoutOptions,
  bundleRule,
}: CartDrawerProps) {
  const isOpen = useCartStore((state) => state.isOpen);
  const close = useCartStore((state) => state.close);
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const setLineExtras = useCartStore((state) => state.setLineExtras);

  const [step, setStep] = useState<'cart' | 'checkout' | 'placed'>('cart');
  const [placed, setPlaced] = useState<{ code: string; whatsappUrl: string | null }>();
  const [addingTo, setAddingTo] = useState<string>();

  /** Same rule as the card and as `pricing.service`: the size and the tier set
   *  the price. */
  function addOnPrice(line: CartLine, addOn: CartAddOn) {
    const variant = line.variants.find(
      (v) => sizePricingByOption[v.optionId] != null || v.extraPrice != null,
    );
    // Catalogue first, the line's own snapshot second: a cart persisted before
    // the carta changed still carries the old numbers.
    const size = variant
      ? (sizePricingByOption[variant.optionId] ?? {
          extraPrice: variant.extraPrice ?? null,
          extraPremiumPrice: variant.extraPremiumPrice ?? null,
        })
      : null;
    return resolveExtraPrice({
      size,
      isPremium: addOn.isPremium,
      catalogPrice: addOn.price,
    });
  }

  function toggleAddOn(line: CartLine, addOn: CartAddOn) {
    const already = line.extras.some((e) => e.extraId === addOn.extraId);
    setLineExtras(
      line.cartItemId,
      already
        ? line.extras.filter((e) => e.extraId !== addOn.extraId)
        : [
            ...line.extras,
            {
              extraId: addOn.extraId,
              name: addOn.name,
              unitPrice: addOnPrice(line, addOn),
              quantity: 1,
            },
          ],
    );
  }

  // Avoids a hydration mismatch: the persisted cart is only known client-side.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Back to the cart view whenever the drawer is reopened later.
  useEffect(() => {
    if (!isOpen) {
      setStep('cart');
      setPlaced(undefined);
    }
  }, [isOpen]);

  const subtotal = lines.reduce((sum, line) => sum + estimateLineTotal(line), 0);

  const bundleUnits = bundleRule ? toBundleUnits(lines) : [];
  const promoDiscount = bundleRule ? bundleDiscount(bundleUnits, bundleRule) : 0;
  // Non-zero only when a bundle is already half-built: suggesting a second
  // pizza to somebody who has not added a single qualifying one is an ad, not
  // help.
  const missingForBundle = bundleRule ? unitsToNextBundle(bundleUnits, bundleRule) : 0;

  // The drawer stays open: the WhatsApp link needs a real tap to survive the
  // mobile popup blocker, so the customer has to see it before anything closes.
  function handlePlaced(result: { code: string; whatsappUrl: string | null }) {
    setPlaced(result);
    setStep('placed');
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? undefined : close())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" />
            {step === 'cart'
              ? 'Tu pedido'
              : step === 'checkout'
                ? 'Finalizar pedido'
                : '¡Pedido recibido!'}
          </SheetTitle>
        </SheetHeader>

        {step === 'placed' && placed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <CheckCircle2 className="text-success size-12" aria-hidden />
            <div className="space-y-1">
              <p className="font-display text-lg font-semibold">Pedido {placed.code}</p>
              <p className="text-muted-foreground max-w-prose text-sm">
                Ya quedó guardado. Envíanoslo por WhatsApp para que lo empecemos a preparar.
              </p>
            </div>

            {placed.whatsappUrl ? (
              <Button asChild size="lg" className="w-full">
                <a href={placed.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" aria-hidden />
                  Enviar por WhatsApp
                </a>
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">
                Guardamos tu pedido. Te llamamos al teléfono que dejaste para confirmarlo.
              </p>
            )}

            <Button variant="ghost" onClick={close}>
              Seguir viendo el menú
            </Button>
          </div>
        ) : !hydrated || lines.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <ShoppingBag className="size-10 opacity-40" />
            <p>Tu carrito está vacío.</p>
            <Button variant="outline" onClick={close}>
              Ver el menú
            </Button>
          </div>
        ) : step === 'checkout' ? (
          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="pb-6">
              {/* The only react-query consumer in the app, so the client lives
                  here instead of in the root layout. Mounted with the checkout
                  step, which also means its cache dies when the drawer closes —
                  fine: the totals preview must be re-fetched anyway. */}
              <QueryProvider>
                <CheckoutForm
                  options={checkoutOptions}
                  onBack={() => setStep('cart')}
                  onPlaced={handlePlaced}
                />
              </QueryProvider>
            </div>
          </ScrollArea>
        ) : (
          <>
            <ScrollArea className="min-h-0 flex-1 px-4">
              <ul className="divide-border divide-y">
                {lines.map((line) => (
                  <li key={line.cartItemId} className="flex gap-3 py-4">
                    <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg">
                      {line.image && (
                        <Image
                          src={line.image}
                          alt={line.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="line-clamp-1 text-sm font-medium">{line.name}</p>
                      {line.variants.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                          {line.variants.map((v) => v.optionName).join(' · ')}
                        </p>
                      )}
                      {/* Each add-on removable where it is shown, instead of
                          forcing a trip back to the menu to undo one. */}
                      {line.extras.length > 0 && (
                        <ul className="flex flex-wrap gap-1">
                          {line.extras.map((extra) => (
                            <li key={extra.extraId}>
                              <button
                                type="button"
                                onClick={() =>
                                  setLineExtras(
                                    line.cartItemId,
                                    line.extras.filter((e) => e.extraId !== extra.extraId),
                                  )
                                }
                                aria-label={`Quitar ${extra.name}`}
                                className="border-border text-muted-foreground hover:border-destructive hover:text-destructive flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors"
                              >
                                {extra.name}
                                <span className="tabular-nums">
                                  +{formatMoney(extra.unitPrice)}
                                </span>
                                <X className="size-3" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {(addOnsByProduct[line.productId]?.length ?? 0) > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setAddingTo((current) =>
                                current === line.cartItemId ? undefined : line.cartItemId,
                              )
                            }
                            aria-expanded={addingTo === line.cartItemId}
                            className="text-primary text-xs font-medium hover:underline"
                          >
                            {addingTo === line.cartItemId ? 'Listo' : '+ Agregar algo'}
                          </button>

                          {addingTo === line.cartItemId && (
                            <div
                              role="group"
                              aria-label={`Agregados para ${line.name}`}
                              className="flex flex-wrap gap-1 pt-1.5"
                            >
                              {(addOnsByProduct[line.productId] ?? []).map((addOn) => {
                                const picked = line.extras.some((e) => e.extraId === addOn.extraId);
                                return (
                                  <button
                                    key={addOn.extraId}
                                    type="button"
                                    aria-pressed={picked}
                                    onClick={() => toggleAddOn(line, addOn)}
                                    className={cn(
                                      'rounded-md border px-1.5 py-0.5 text-[11px] transition-colors',
                                      picked
                                        ? 'border-primary bg-primary/10 font-semibold'
                                        : 'border-border hover:border-primary',
                                    )}
                                  >
                                    {addOn.name}
                                    <span className="text-muted-foreground ml-1 tabular-nums">
                                      +{formatMoney(addOnPrice(line, addOn))}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-between">
                        <div className="border-border flex items-center rounded-md border">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setQuantity(line.cartItemId, line.quantity - 1)}
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-6 text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setQuantity(line.cartItemId, line.quantity + 1)}
                            disabled={line.quantity >= MAX_LINE_QUANTITY}
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatMoney(estimateLineTotal(line))}
                        </span>
                      </div>
                      {/* El tope explica el motivo donde molesta: si no, el `+`
                          queda muerto sin razón visible. */}
                      {line.quantity >= MAX_LINE_QUANTITY && (
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          Máximo {MAX_LINE_QUANTITY} por línea. Para más, llámanos y lo coordinamos.
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeLine(line.cartItemId)}
                      aria-label={`Quitar ${line.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            <SheetFooter className="border-border flex-col gap-3 border-t px-4 pt-4">
              {bundleRule && missingForBundle > 0 && (
                <p
                  role="status"
                  className="border-primary/40 bg-primary/5 text-foreground rounded-lg border px-3 py-2 text-sm"
                >
                  Agrega {missingForBundle === 1 ? 'otra' : `${missingForBundle} más`} de{' '}
                  {bundleRule.variantName} y las {spellOut(bundleRule.bundleSize)} te salen{' '}
                  <span className="font-semibold">{formatMoney(bundleRule.bundlePrice)}</span>.
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatMoney(subtotal)}</span>
              </div>

              {promoDiscount > 0 && (
                <>
                  <div className="text-success flex items-center justify-between text-sm">
                    <span>{bundleRule?.name}</span>
                    <span className="font-semibold">−{formatMoney(promoDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base">
                    <span className="font-medium">Total</span>
                    <span className="font-bold">{formatMoney(subtotal - promoDiscount)}</span>
                  </div>
                </>
              )}
              <Separator />
              <Button size="lg" className="w-full" onClick={() => setStep('checkout')}>
                Continuar al pago
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
