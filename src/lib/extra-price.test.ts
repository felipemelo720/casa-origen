import { describe, expect, it } from 'vitest';

import { resolveExtraPrice, sizeExtraPrice } from './extra-price';

/** The carta's two sizes. */
const SMALL = { extraPrice: 700, extraPremiumPrice: 1000 };
const LARGE = { extraPrice: 1200, extraPremiumPrice: 1500 };

describe('sizeExtraPrice', () => {
  it('prices the standard tier by size', () => {
    expect(sizeExtraPrice(SMALL, false)).toBe(700);
    expect(sizeExtraPrice(LARGE, false)).toBe(1200);
  });

  it('prices the premium tier by size', () => {
    expect(sizeExtraPrice(SMALL, true)).toBe(1000);
    expect(sizeExtraPrice(LARGE, true)).toBe(1500);
  });

  it('charges the standard price when the size does not split by tier', () => {
    // Not a free premium topping: a size with one price charges it for all.
    expect(sizeExtraPrice({ extraPrice: 900, extraPremiumPrice: null }, true)).toBe(900);
  });

  it('is null when the size does not price add-ons at all', () => {
    expect(sizeExtraPrice(null, false)).toBeNull();
    expect(sizeExtraPrice({ extraPrice: null, extraPremiumPrice: null }, false)).toBeNull();
  });
});

describe('resolveExtraPrice', () => {
  it('lets the size win over the catalogue price', () => {
    expect(
      resolveExtraPrice({ size: LARGE, isPremium: true, catalogPrice: 1500, priceOverride: 800 }),
    ).toBe(1500);
  });

  it('falls back to the per-product override when no size prices add-ons', () => {
    expect(
      resolveExtraPrice({ size: null, isPremium: true, catalogPrice: 1500, priceOverride: 800 }),
    ).toBe(800);
  });

  it('falls back to the catalogue price last', () => {
    expect(resolveExtraPrice({ size: null, isPremium: false, catalogPrice: 700 })).toBe(700);
  });

  it('treats a zero override as a real price, not as missing', () => {
    expect(
      resolveExtraPrice({ size: null, isPremium: false, catalogPrice: 700, priceOverride: 0 }),
    ).toBe(0);
  });
});
