import { formatMoney } from '@/lib/money';

export type CouponBenefitInput = {
  discountType: 'PERCENTAGE' | 'FIXED' | 'BUNDLE_PRICE';
  value: number;
  maxDiscount: number | null;
  freeDelivery: boolean;
  minSubtotal: number;
};

/**
 * Qué entrega un cupón, en una línea. Puro y sin `server-only`: lo usa la fila
 * de `/admin` y el banner público de la landing, y las dos rutas tienen que
 * describir el mismo cupón con el mismo texto.
 *
 * Se arma acá y no en el JSX porque el caso interesante es el que rompió el
 * motor: un `FIXED` de $0 cuyo único efecto es el envío gratis. Escrito como
 * «$0 + envío gratis» parece un error de carga; se lee «Envío gratis» y punto.
 */
export function describeCouponBenefit(coupon: CouponBenefitInput): string {
  const parts: string[] = [];

  if (coupon.discountType === 'PERCENTAGE') {
    parts.push(`${coupon.value}%`);
    if (coupon.maxDiscount !== null) parts.push(`tope ${formatMoney(coupon.maxDiscount)}`);
  } else if (coupon.value > 0) {
    parts.push(formatMoney(coupon.value));
  }

  if (coupon.freeDelivery) parts.push(parts.length === 0 ? 'Envío gratis' : 'envío gratis');
  if (coupon.minSubtotal > 0) parts.push(`desde ${formatMoney(coupon.minSubtotal)}`);

  return parts.join(' · ');
}
