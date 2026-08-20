import { Ticket } from 'lucide-react';

import { ApplyCouponButton } from '@/features/storefront/apply-coupon-button';
import { describeCouponBenefit, type CouponBenefitInput } from '@/lib/coupon-copy';

type Props = {
  coupon: CouponBenefitInput & { code: string };
};

/**
 * El único cupón que la tienda decide anunciar (`isPublic`), entre la trust
 * bar y las cards de promo. Franja delgada y no un bloque `bg-primary`: ese
 * acento ya lo llevan `DuoPromoCard` y `ComboPromoCard` un scroll más abajo, y
 * un tercer bloque con el mismo peso rompería la regla de un solo elemento
 * dominante por pantalla.
 *
 * Server component salvo el botón, que es la única interacción real.
 */
export function CouponBanner({ coupon }: Props) {
  return (
    <section className="border-border bg-secondary/40 border-b">
      <div className="reveal mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 text-center sm:px-6 lg:px-8">
        <Ticket className="text-primary size-5 shrink-0" aria-hidden />
        <p className="text-sm">
          <span className="font-mono font-semibold tracking-wide">{coupon.code}</span>
          <span className="text-muted-foreground"> · {describeCouponBenefit(coupon)}</span>
        </p>
        <ApplyCouponButton code={coupon.code} />
      </div>
    </section>
  );
}
