'use client';

import { useState } from 'react';
import { Check, Copy, Ticket } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { useCartStore } from '@/features/cart/cart-store';

export type PublicCoupon = {
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  value: number;
  minSubtotal: number;
  freeDelivery: boolean;
  endsAt: Date | null;
};

/** "10% de descuento" / "$3.000 de descuento" / "despacho gratis". */
function describeDiscount(coupon: PublicCoupon): string {
  if (coupon.freeDelivery && coupon.value === 0) return 'Despacho gratis';
  return coupon.discountType === 'PERCENTAGE'
    ? `${coupon.value}% de descuento`
    : `${formatMoney(coupon.value)} de descuento`;
}

/**
 * Surfaces the one public code. The checkout already had a coupon field, but
 * nothing on the site ever told a customer what to type into it.
 */
export function CouponBanner({ coupon }: { coupon: PublicCoupon }) {
  const setCoupon = useCartStore((state) => state.setCoupon);
  const [copied, setCopied] = useState(false);

  async function apply() {
    // Pre-load the cart so the code is already applied when they reach checkout.
    setCoupon(coupon.code);

    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(`Código ${coupon.code} copiado y aplicado a tu pedido.`);
    } catch {
      // Clipboard is blocked outside secure contexts; the code is applied anyway.
      toast.success(`Código ${coupon.code} aplicado a tu pedido.`);
    }
  }

  return (
    <div className="border-primary/30 bg-primary/5 flex flex-wrap items-center gap-4 rounded-2xl border border-dashed p-6">
      <Ticket className="text-primary size-8 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold">{describeDiscount(coupon)}</p>
        <p className="text-muted-foreground text-sm">
          {coupon.description ?? 'Válido en tu próximo pedido.'}
          {coupon.minSubtotal > 0 && ` · Sobre ${formatMoney(coupon.minSubtotal)}`}
          {coupon.endsAt &&
            ` · Hasta el ${coupon.endsAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <code className="border-primary/40 rounded-lg border border-dashed px-3 py-2 text-sm font-semibold tracking-widest">
          {coupon.code}
        </code>
        <Button onClick={apply} variant="outline">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Listo' : 'Usar'}
        </Button>
      </div>
    </div>
  );
}
