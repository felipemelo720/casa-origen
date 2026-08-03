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
import { Label } from '@/components/ui/label';
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
import { formatMoney } from '@/lib/money';
import { openWhatsAppOrder } from '@/lib/whatsapp';
import { estimateLineTotal, toCartItemInput, useCartStore } from '@/features/cart/cart-store';
import { getCheckoutOptionsAction, placeOrderAction, previewCartTotalsAction } from '@/server/actions/checkout.actions';

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
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['street'], message: 'Ingresa tu dirección.' });
      }
      if (!data.communeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['communeId'], message: 'Selecciona tu comuna.' });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

/** Checkout step rendered inside the cart drawer — no separate /checkout page. */
export function CheckoutForm({ onBack, onPlaced }: { onBack: () => void; onPlaced: (code: string) => void }) {
  const lines = useCartStore((state) => state.lines);
  const couponCode = useCartStore((state) => state.couponCode);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const orderType = useCartStore((state) => state.orderType);
  const setOrderType = useCartStore((state) => state.setOrderType);
  const communeId = useCartStore((state) => state.communeId);
  const setCommune = useCartStore((state) => state.setCommune);
  const clearCart = useCartStore((state) => state.clear);

  const [couponInput, setCouponInput] = useState(couponCode ?? '');
  const [submitting, setSubmitting] = useState(false);

  const optionsQuery = useQuery({
    queryKey: ['checkout-options'],
    queryFn: () => getCheckoutOptionsAction(undefined),
  });
  const options = optionsQuery.data?.ok ? optionsQuery.data.data : null;
  const communes = options?.communes ?? [];
  const paymentMethods = options?.paymentMethods ?? [];

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
  const previewError = previewQuery.data && !previewQuery.data.ok ? previewQuery.data.message : null;

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

    if (options?.whatsapp) {
      openWhatsAppOrder(options.whatsapp, lines, {
        code: result.data.code,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        orderType: values.orderType,
        street: values.street,
        communeName: communes.find((c) => c.id === values.communeId)?.name,
        paymentMethodName: selectedPaymentMethod?.name ?? '',
        cashGiven: selectedPaymentMethod?.requiresChange ? cashGivenAmount : undefined,
        notes: values.notes,
        total: result.data.total,
      });
    }

    clearCart();
    onPlaced(result.data.code);
  }

  function applyCoupon() {
    setCoupon(couponInput.trim() || undefined);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ChevronLeft className="size-4" />
        Volver al carrito
      </Button>

      <section className="space-y-3">
        <h3 className="font-display text-sm font-semibold">Tipo de entrega</h3>
        <RadioGroup
          value={watchedOrderType}
          onValueChange={(v) => form.setValue('orderType', v as 'DELIVERY' | 'PICKUP')}
          className="grid grid-cols-2 gap-2"
        >
          <label className="border-border has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <RadioGroupItem value="DELIVERY" />
            Delivery
          </label>
          <label className="border-border has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <RadioGroupItem value="PICKUP" />
            Retiro
          </label>
        </RadioGroup>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-sm font-semibold">Tus datos</h3>
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" {...form.register('firstName')} />
          {form.formState.errors.firstName && (
            <p className="text-destructive text-sm">{form.formState.errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" {...form.register('lastName')} />
          {form.formState.errors.lastName && (
            <p className="text-destructive text-sm">{form.formState.errors.lastName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" placeholder="+56 9 1234 5678" {...form.register('phone')} />
          {form.formState.errors.phone && (
            <p className="text-destructive text-sm">{form.formState.errors.phone.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo (opcional)</Label>
          <Input id="email" type="email" {...form.register('email')} />
          {form.formState.errors.email && (
            <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
          )}
        </div>
      </section>

      {watchedOrderType === 'DELIVERY' && (
        <section className="space-y-3">
          <h3 className="font-display text-sm font-semibold">Dirección de despacho</h3>
          <div className="space-y-1.5">
            <Label htmlFor="street">Calle y número</Label>
            <Input id="street" {...form.register('street')} />
            {form.formState.errors.street && (
              <p className="text-destructive text-sm">{form.formState.errors.street.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reference">Referencia (opcional)</Label>
            <Input id="reference" placeholder="Depto, color de la casa…" {...form.register('reference')} />
          </div>
          <div className="space-y-1.5">
            <Label>Comuna</Label>
            <Select
              value={watchedCommuneId || undefined}
              onValueChange={(value) => form.setValue('communeId', value)}
              disabled={optionsQuery.isLoading}
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
            {form.formState.errors.communeId && (
              <p className="text-destructive text-sm">{form.formState.errors.communeId.message}</p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-display text-sm font-semibold">Método de pago</h3>
        <RadioGroup
          value={watchedPaymentMethodId}
          onValueChange={(value) => form.setValue('paymentMethodId', value)}
          className="space-y-2"
        >
          {paymentMethods.map((pm) => (
            <label
              key={pm.id}
              className="border-border has-[[data-state=checked]]:border-primary flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <RadioGroupItem value={pm.id} className="mt-0.5" />
              <span>
                <span className="block font-medium">{pm.name}</span>
                {pm.description && <span className="text-muted-foreground block text-xs">{pm.description}</span>}
              </span>
            </label>
          ))}
        </RadioGroup>
        {form.formState.errors.paymentMethodId && (
          <p className="text-destructive text-sm">{form.formState.errors.paymentMethodId.message}</p>
        )}

        {selectedPaymentMethod?.requiresChange && (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="cashGiven">¿Con cuánto pagas?</Label>
            <Input id="cashGiven" inputMode="numeric" placeholder="$" {...form.register('cashGiven')} />
            {preview && cashGivenAmount > 0 && (
              <p className="text-muted-foreground text-sm">Vuelto: {formatMoney(changeDue)}</p>
            )}
          </div>
        )}
        {selectedPaymentMethod?.instructions && (
          <p className="text-muted-foreground text-sm">{selectedPaymentMethod.instructions}</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Observaciones</h3>
        <Textarea placeholder="Alguna indicación para tu pedido…" {...form.register('notes')} />
      </section>

      <Separator />

      <section className="space-y-2">
        <div className="flex gap-2">
          <Input placeholder="Código de cupón" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
          <Button type="button" variant="outline" onClick={applyCoupon}>
            Aplicar
          </Button>
        </div>

        {previewError && <p className="text-destructive text-sm">{previewError}</p>}

        <div className="space-y-1.5 text-sm">
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
              <span>{preview ? formatMoney(preview.deliveryFee) : '—'}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(preview?.total ?? subtotal)}</span>
          </div>
        </div>
      </section>

      <Button type="submit" size="lg" className="w-full" disabled={submitting || items.length === 0 || optionsQuery.isLoading}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Confirmar pedido
      </Button>
    </form>
  );
}
