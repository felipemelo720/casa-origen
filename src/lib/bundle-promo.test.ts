import { describe, expect, it } from 'vitest';

import {
  bundleDiscount,
  isBundleEligible,
  unitsToNextBundle,
  type BundleRule,
  type BundleUnit,
} from './bundle-promo';

/** Promo Dúo as seeded: two 32 cm pizzas for $17.990, no product restriction. */
function duoRule(overrides: Partial<BundleRule> = {}): BundleRule {
  return {
    promotionId: 'promo-duo',
    name: 'Promo Dúo',
    bundlePrice: 17990,
    bundleSize: 2,
    variantName: '32 cm',
    eligibleProductIds: [],
    ...overrides,
  };
}

function unit(unitPrice: number, overrides: Partial<BundleUnit> = {}): BundleUnit {
  return {
    productId: 'pepperoni',
    unitPrice,
    variantNames: ['32 cm'],
    ...overrides,
  };
}

describe('isBundleEligible', () => {
  it('requires the bundle variant', () => {
    expect(isBundleEligible(unit(10000, { variantNames: ['24 cm'] }), duoRule())).toBe(false);
    expect(isBundleEligible(unit(10000), duoRule())).toBe(true);
  });

  it('accepts every product when no product list is configured', () => {
    expect(isBundleEligible(unit(12500, { productId: 'mechada' }), duoRule())).toBe(true);
  });

  it('honours a product allow-list', () => {
    const rule = duoRule({ eligibleProductIds: ['pepperoni', 'napolitana'] });
    expect(isBundleEligible(unit(12500, { productId: 'mechada' }), rule)).toBe(false);
    expect(isBundleEligible(unit(10000, { productId: 'napolitana' }), rule)).toBe(true);
  });
});

describe('bundleDiscount', () => {
  it('grants nothing on an incomplete bundle', () => {
    expect(bundleDiscount([unit(10000)], duoRule())).toBe(0);
  });

  it('discounts a complete pair down to the bundle price', () => {
    // 10.000 + 10.000 = 20.000 → 17.990
    expect(bundleDiscount([unit(10000), unit(10000)], duoRule())).toBe(2010);
  });

  it('ignores units without the bundle variant', () => {
    const units = [unit(10000), unit(5500, { variantNames: ['24 cm'] })];
    expect(bundleDiscount(units, duoRule())).toBe(0);
  });

  it('bundles the most expensive units first', () => {
    // Mechada (12.500) + Tres Carnes (11.000) beats pairing either with the
    // 10.000 one: 23.500 − 17.990 = 5.510.
    const units = [unit(10000), unit(12500), unit(11000)];
    expect(bundleDiscount(units, duoRule())).toBe(5510);
  });

  it('applies once per complete bundle and leaves the remainder alone', () => {
    const units = [unit(10000), unit(10000), unit(10000), unit(10000), unit(10000)];
    expect(bundleDiscount(units, duoRule())).toBe(2010 * 2);
  });

  it('never turns into a surcharge when the pair is cheaper than the bundle', () => {
    // Two hypothetical $8.000 pizzas would cost $16.000 on their own: the promo
    // must grant nothing rather than push the cart up to $17.990.
    expect(bundleDiscount([unit(8000), unit(8000)], duoRule())).toBe(0);
  });

  it('grants nothing on a misconfigured bundle size', () => {
    expect(bundleDiscount([unit(10000), unit(10000)], duoRule({ bundleSize: 0 }))).toBe(0);
  });
});

describe('unitsToNextBundle', () => {
  it('is zero with no eligible units at all', () => {
    expect(unitsToNextBundle([unit(5500, { variantNames: ['24 cm'] })], duoRule())).toBe(0);
  });

  it('reports what is missing to complete the pair', () => {
    expect(unitsToNextBundle([unit(10000)], duoRule())).toBe(1);
  });

  it('is zero on a complete bundle', () => {
    expect(unitsToNextBundle([unit(10000), unit(10000)], duoRule())).toBe(0);
  });

  it('counts against the next bundle, not the first', () => {
    expect(unitsToNextBundle([unit(10000), unit(10000), unit(10000)], duoRule())).toBe(1);
  });
});
