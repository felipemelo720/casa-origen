'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/money';
import { estimateLineTotal, useCartStore } from '@/features/cart/cart-store';
import { CheckoutForm } from '@/features/checkout/checkout-form';

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const close = useCartStore((state) => state.close);
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);

  const [step, setStep] = useState<'cart' | 'checkout'>('cart');

  // Avoids a hydration mismatch: the persisted cart is only known client-side.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Back to the cart view whenever the drawer is reopened later.
  useEffect(() => {
    if (!isOpen) setStep('cart');
  }, [isOpen]);

  const subtotal = lines.reduce((sum, line) => sum + estimateLineTotal(line), 0);

  function handlePlaced(code: string) {
    close();
    toast.success(`Pedido ${code} enviado por WhatsApp.`);
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? undefined : close())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" />
            {step === 'cart' ? 'Tu pedido' : 'Finalizar pedido'}
          </SheetTitle>
        </SheetHeader>

        {!hydrated || lines.length === 0 ? (
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
              <CheckoutForm onBack={() => setStep('cart')} onPlaced={handlePlaced} />
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
                        <Image src={line.image} alt={line.name} fill className="object-cover" sizes="64px" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="line-clamp-1 text-sm font-medium">{line.name}</p>
                      {line.variants.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                          {line.variants.map((v) => v.optionName).join(' · ')}
                        </p>
                      )}
                      {line.extras.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                          + {line.extras.map((e) => e.name).join(', ')}
                        </p>
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
                          <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setQuantity(line.cartItemId, line.quantity + 1)}
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatMoney(estimateLineTotal(line))}
                        </span>
                      </div>
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatMoney(subtotal)}</span>
              </div>
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
