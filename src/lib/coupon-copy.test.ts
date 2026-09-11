import { describe, expect, it } from 'vitest';
import { describeCouponBenefit, type CouponBenefitInput } from './coupon-copy';

function coupon(overrides: Partial<CouponBenefitInput> = {}): CouponBenefitInput {
  return {
    discountType: 'FIXED',
    value: 0,
    maxDiscount: null,
    freeDelivery: false,
    minSubtotal: 0,
    ...overrides,
  };
}

describe('describeCouponBenefit', () => {
  it('describes a percentage discount', () => {
    expect(describeCouponBenefit(coupon({ discountType: 'PERCENTAGE', value: 10 }))).toBe('10%');
  });

  it('adds the cap on a percentage discount with maxDiscount', () => {
    expect(
      describeCouponBenefit(coupon({ discountType: 'PERCENTAGE', value: 10, maxDiscount: 5000 })),
    ).toBe('10% · tope $5.000');
  });

  it('describes a fixed discount', () => {
    expect(describeCouponBenefit(coupon({ discountType: 'FIXED', value: 3000 }))).toBe('$3.000');
  });

  // The bug this file exists to prevent: a FIXED $0 coupon whose only real
  // effect is free delivery must never read as "$0 + envío gratis".
  it('reads as just "Envío gratis" for a $0 fixed coupon with free delivery', () => {
    expect(
      describeCouponBenefit(coupon({ discountType: 'FIXED', value: 0, freeDelivery: true })),
    ).toBe('Envío gratis');
  });

  it('capitalizes "Envío gratis" only when it leads, lowercase when it follows a discount', () => {
    const leads = describeCouponBenefit(coupon({ value: 0, freeDelivery: true }));
    const follows = describeCouponBenefit(coupon({ value: 2000, freeDelivery: true }));
    expect(leads.startsWith('Envío gratis')).toBe(true);
    expect(follows).toBe('$2.000 · envío gratis');
  });

  it('appends the minimum subtotal when set', () => {
    expect(describeCouponBenefit(coupon({ value: 1000, minSubtotal: 15000 }))).toBe(
      '$1.000 · desde $15.000',
    );
  });

  it('returns an empty string for a coupon with no visible effect at all', () => {
    expect(describeCouponBenefit(coupon())).toBe('');
  });

  it('joins every active part with the same separator, in a fixed order', () => {
    const result = describeCouponBenefit(
      coupon({
        discountType: 'PERCENTAGE',
        value: 15,
        maxDiscount: 5000,
        freeDelivery: true,
        minSubtotal: 10000,
      }),
    );
    expect(result).toBe('15% · tope $5.000 · envío gratis · desde $10.000');
  });
});
