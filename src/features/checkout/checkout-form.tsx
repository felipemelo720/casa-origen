'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorCode } from '@/lib/errors';
import { formatMoney, formatMoneyRange } from '@/lib/money';
import { estimateLineTotal, toCartItemInput, useCartStore } from '@/features/cart/cart-store';
import { placeOrderAction, previewCartTotalsAction } from '@/server/actions/checkout.actions';

/**
 * Everything the checkout needs that does not depend on the cart. Loaded by the
 * storefront layout and passed down, so the form renders complete on first
 * paint instead of filling in after a round trip.
 *
 * Narrow on purpose: these start life as Prisma rows and this is a client
 * component. `deliveryEnabled` only hides the option here — `placeOrder`
 * re-checks it server-side.
 */
export type CheckoutOptions = {
  communes: { id: string; name: string }[];
  paymentMethods: {
    id: string;
    name: string;
    description: string | null;
    instructions: string | null;
    requiresChange: boolean;
  }[];
  deliveryEnabled: boolean;
};

const chileanPhone = /^\+?56?\s?9\d{8}$|^\+?\d{8,15}$/;

const formSchema = z
  .object({
    orderType: z.enum(['DELIVERY', 'PICKUP']),
    firstName: z.string().trim().min(2, 'Ingresa tu nombre.').max(60),
    lastName: z.string().trim().min(2, 'Ingresa tu apellido.').max(60),
    phone: z.string().trim().regex(chileanPhone, 'Ingresa un teléfono válido.'),
    email: z.string().trim().email('Ingresa un correo válido.').optional().or(z.literal('')),
    street: z.string().trim().max(160).optional(),
    reference: z.string().trim().max(160).optional(),
    communeId: z.string().optional(),
    notes: z.string().trim().max(300).optional(),
    paymentMethodId: z.string().min(1, 'Selecciona un método de pago.'),
    cashGiven: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === 'DELIVERY') {
      if (!data.street || data.street.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['street'],
          message: 'Ingresa tu dirección.',
        });
      }
      if (!data.communeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['communeId'],
          message: 'Selecciona tu comuna.',
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

/** Checkout step rendered inside the cart drawer — no separate /checkout page. */
export function CheckoutForm({
  options,
  onBack,
  onPlaced,
}: {
  options: CheckoutOptions;
  onBack: () => void;
  onPlaced: (placed: { code: string; whatsappUrl: string | null }) => void;
}) {
  const lines = useCartStore((state) => state.lines);
  const couponCode = useCartStore((state) => state.couponCode);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const orderType = useCartStore((state) => state.orderType);
  const setOrderType = useCartStore((state) => state.setOrderType);
  const communeId = useCartStore((state) => state.communeId);
  const setCommune = useCartStore((state) => state.setCommune);
  const clearCart = useCartStore((state) => state.clear);

  const [couponInput, setCouponInput] = useState(couponCode ?? '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { communes, paymentMethods, deliveryEnabled } = options;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderType,
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      street: '',
      reference: '',
      communeId: communeId ?? '',
      notes: '',
      paymentMethodId: '',
      cashGiven: '',
    },
  });

  const watchedOrderType = form.watch('orderType');
  const watchedCommuneId = form.watch('communeId');
  const watchedPaymentMethodId = form.watch('paymentMethodId');
  const watchedCashGiven = form.watch('cashGiven');

  useEffect(() => {
    setOrderType(watchedOrderType);
  }, [watchedOrderType, setOrderType]);

  // The cart store defaults to DELIVERY and persists, so a customer can land here
  // with DELIVERY selected after the admin switched it off. Fall back to PICKUP.
  useEffect(() => {
    if (!deliveryEnabled && watchedOrderType === 'DELIVERY') {
      form.setValue('orderType', 'PICKUP');
    }
  }, [deliveryEnabled, watchedOrderType, form]);

  useEffect(() => {
    setCommune(watchedCommuneId || undefined);
  }, [watchedCommuneId, setCommune]);

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.id === watchedPaymentMethodId);

  const items = useMemo(() => lines.map(toCartItemInput), [lines]);
  const itemsKey = useMemo(() => JSON.stringify(items), [items]);

  const previewQuery = useQuery({
    queryKey: ['checkout-preview', itemsKey, couponCode, watchedOrderType, watchedCommuneId],
    queryFn: () =>
      previewCartTotalsAction({
        items,
        couponCode,
        orderType: watchedOrderType,
        communeId: watchedOrderType === 'DELIVERY' ? watchedCommuneId : undefined,
      }),
    enabled: items.length > 0,
  });

  const preview = previewQuery.data?.ok ? previewQuery.data.data : null;
  const previewError =
    previewQuery.data && !previewQuery.data.ok ? previewQuery.data.message : null;

  // The code is persisted in `localStorage`, so a rejected coupon would keep
  // failing every quote from here on and leave the cart unable to check out
  // with no way to take it back. Drop the code and keep the reason on screen —
  // only for a coupon error: a cart the server rejects for any other reason
  // must not lose the coupon the customer applied.
  const previewFailure = previewQuery.data && !previewQuery.data.ok ? previewQuery.data : null;
  useEffect(() => {
    if (previewFailure?.code === ErrorCode.COUPON_INVALID) {
      setCouponError(previewFailure.message);
      setCoupon(undefined);
    }
  }, [previewFailure, setCoupon]);

  const subtotal = lines.reduce((sum, line) => sum + estimateLineTotal(line), 0);
  const cashGivenAmount = Number.parseInt((watchedCashGiven ?? '').replace(/[^\d]/g, ''), 10) || 0;
  const changeDue = preview ? Math.max(0, cashGivenAmount - preview.total) : 0;

  async function onSubmit(values: FormValues) {
    if (items.length === 0) {
      toast.error('Tu carrito está vacío.');
      return;
    }

    setSubmitting(true);
    const result = await placeOrderAction({
      cart: { items, couponCode },
      orderType: values.orderType,
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email || undefined,
      street: values.orderType === 'DELIVERY' ? values.street : undefined,
      reference: values.reference || undefined,
      communeId: values.orderType === 'DELIVERY' ? values.communeId : undefined,
      notes: values.notes || undefined,
      paymentMethodId: values.paymentMethodId,
      cashGiven: selectedPaymentMethod?.requiresChange ? cashGivenAmount : undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof FormValues, { message: messages[0] });
        }
      }
      return;
    }

    // No `window.open` here on purpose: the await above already spent the user
    // gesture, so mobile browsers block the popup. The confirmation step below
    // renders a plain link the customer taps instead.
    clearCart();
    onPlaced({ code: result.data.code, whatsappUrl: result.data.whatsappUrl });
  }

  /** One compact error line per section instead of a label + message per field. */
  function firstErrorOf(...fields: (keyof FormValues)[]): string | undefined {
    for (const field of fields) {
      const message = form.formState.errors[field]?.message;
      if (message) return String(message);
    }
    return undefined;
  }

  function applyCoupon() {
    setCouponError(null);
    setCoupon(couponInput.trim() || undefined);
  }

  function removeCoupon() {
    setCouponError(null);
    setCouponInput('');
    setCoupon(undefined);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 h-7">
        <ChevronLeft className="size-4" />
        Volver al carrito
      </Button>

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Tipo de entrega</h3>
        <RadioGroup
          value={watchedOrderType}
          onValueChange={(v) => form.setValue('orderType', v as 'DELIVERY' | 'PICKUP')}
          className={deliveryEnabled ? 'grid grid-cols-2 gap-2' : 'grid gap-2'}
        >
          {deliveryEnabled && (
            <label className="border-border has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <RadioGroupItem value="DELIVERY" />
              Delivery
            </label>
          )}
          <label className="border-border has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <RadioGroupItem value="PICKUP" />
            Retiro
          </label>
        </RadioGroup>
        {!deliveryEnabled && (
          <p className="text-muted-foreground text-sm">
            El delivery no está disponible por ahora. Solo retiro en tienda.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Tus datos</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Nombre" aria-label="Nombre" {...form.register('firstName')} />
          <Input placeholder="Apellido" aria-label="Apellido" {...form.register('lastName')} />
          <Input placeholder="+56 9 1234 5678" aria-label="Teléfono" {...form.register('phone')} />
          <Input
            type="email"
            placeholder="Correo (opcional)"
            aria-label="Correo"
            {...form.register('email')}
          />
        </div>
        {firstErrorOf('firstName', 'lastName', 'phone', 'email') && (
          <p className="text-destructive text-xs">
            {firstErrorOf('firstName', 'lastName', 'phone', 'email')}
          </p>
        )}
      </section>

      {watchedOrderType === 'DELIVERY' && (
        <section className="space-y-2">
          <h3 className="font-display text-sm font-semibold">Dirección de despacho</h3>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Calle y número"
              aria-label="Calle y número"
              {...form.register('street')}
            />
            <Input
              placeholder="Depto, referencia…"
              aria-label="Referencia"
              {...form.register('reference')}
            />
          </div>
          <div>
            <Select
              value={watchedCommuneId || undefined}
              onValueChange={(value) => form.setValue('communeId', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona tu comuna" />
              </SelectTrigger>
              <SelectContent>
                {communes.map((commune) => (
                  <SelectItem key={commune.id} value={commune.id}>
                    {commune.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {firstErrorOf('street', 'communeId') && (
            <p className="text-destructive text-xs">{firstErrorOf('street', 'communeId')}</p>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Método de pago</h3>
        <RadioGroup
          value={watchedPaymentMethodId}
          onValueChange={(value) => form.setValue('paymentMethodId', value)}
          className="grid grid-cols-2 gap-2"
        >
          {paymentMethods.map((pm) => (
            <label
              key={pm.id}
              className="border-border has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <RadioGroupItem value={pm.id} />
              <span className="truncate font-medium">{pm.name}</span>
            </label>
          ))}
        </RadioGroup>
        {firstErrorOf('paymentMethodId') && (
          <p className="text-destructive text-xs">{firstErrorOf('paymentMethodId')}</p>
        )}

        {selectedPaymentMethod?.requiresChange && (
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              placeholder="¿Con cuánto pagas?"
              aria-label="¿Con cuánto pagas?"
              {...form.register('cashGiven')}
            />
            {preview && cashGivenAmount > 0 && (
              <span className="text-muted-foreground shrink-0 text-xs">
                Vuelto {formatMoney(changeDue)}
              </span>
            )}
          </div>
        )}
        {(selectedPaymentMethod?.description ?? selectedPaymentMethod?.instructions) && (
          <div className="bg-muted/50 border-border space-y-1 rounded-lg border p-3">
            {selectedPaymentMethod?.description && (
              <p className="text-foreground text-xs font-medium">
                {selectedPaymentMethod.description}
              </p>
            )}
            {selectedPaymentMethod?.instructions && (
              <p className="text-muted-foreground text-xs">{selectedPaymentMethod.instructions}</p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Indicaciones para la cocina</h3>
        <p className="text-muted-foreground text-xs" id="notes-hint">
          Cuéntanos si quieres sacar o cambiar algún ingrediente, la masa más tostada, cortada en
          más porciones, o cualquier detalle de la entrega.
        </p>
        <Textarea
          rows={4}
          placeholder="Ej: la Pepperoni sin orégano y bien cocida. Tocar el timbre del depto 402."
          aria-label="Indicaciones para la cocina"
          aria-describedby="notes-hint"
          maxLength={300}
          className="min-h-24"
          {...form.register('notes')}
        />
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Cupón de descuento</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Ingresa tu código"
            aria-label="Código de cupón"
            className="h-11 flex-1"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
          />
          <Button type="button" variant="outline" className="h-11 px-6" onClick={applyCoupon}>
            Aplicar
          </Button>
        </div>
        {/* `aria-live`: applying a coupon does not move focus, so the outcome
            has to be announced where it happens instead of only changing the
            totals further down. */}
        <div aria-live="polite">
          {couponError && <p className="text-destructive text-xs">{couponError}</p>}
          {couponCode && !couponError && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <span>
                Cupón <span className="text-foreground font-medium">{couponCode}</span> aplicado.
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                className="focus-visible:ring-ring rounded underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                Quitar
              </button>
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        {previewError && <p className="text-destructive text-xs">{previewError}</p>}

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatMoney(preview?.subtotal ?? subtotal)}</span>
          </div>
          {preview && preview.discount > 0 && (
            <div className="text-success flex justify-between">
              <span>Descuento</span>
              <span>-{formatMoney(preview.discount)}</span>
            </div>
          )}
          {watchedOrderType === 'DELIVERY' && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Despacho</span>
              <span>
                {preview ? formatMoneyRange(preview.deliveryFeeMin, preview.deliveryFeeMax) : '—'}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(preview?.total ?? subtotal)}</span>
          </div>
          {/* The total adds the low end of the band, so it is an estimate
              whenever the band is one. Saying so here — not after the order is
              placed — is the difference between a quote and a surprise. */}
          {watchedOrderType === 'DELIVERY' &&
            preview &&
            preview.deliveryFeeMax > preview.deliveryFeeMin && (
              <p className="text-muted-foreground pt-1 text-xs">
                El total incluye el despacho más bajo de tu sector. Te confirmamos el valor exacto
                por WhatsApp según tu dirección.
              </p>
            )}
        </div>
      </section>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={submitting || items.length === 0}
      >
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Confirmar pedido
      </Button>
    </form>
  );
}
