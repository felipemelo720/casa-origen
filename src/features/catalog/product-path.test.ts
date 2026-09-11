import { describe, expect, it } from 'vitest';
import { productPath, promoPath, PRODUCT_PATH_PREFIX, PROMO_PATH_PREFIX } from './product-path';

describe('productPath', () => {
  it('builds the product URL from the slug', () => {
    expect(productPath('pizza-pepperoni')).toBe('/producto/pizza-pepperoni');
  });

  it('uses the shared prefix constant, not a hardcoded string', () => {
    expect(productPath('x')).toBe(`${PRODUCT_PATH_PREFIX}/x`);
  });
});

describe('promoPath', () => {
  it('builds the promo URL from the slug', () => {
    expect(promoPath('duo-mechada')).toBe('/promo/duo-mechada');
  });

  it('uses the shared prefix constant, not a hardcoded string', () => {
    expect(promoPath('x')).toBe(`${PROMO_PATH_PREFIX}/x`);
  });

  it('keeps product and promo paths on distinct prefixes', () => {
    expect(productPath('same-slug')).not.toBe(promoPath('same-slug'));
  });
});
