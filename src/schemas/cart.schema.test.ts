import { describe, expect, it } from 'vitest';
import { cartItemSchema, cartSchema } from './cart.schema';

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    cartItemId: 'cart-1',
    productId: 'prod-1',
    quantity: 1,
    selectedVariantOptionIds: [],
    selectedExtras: [],
    removedIngredientIds: [],
    ...overrides,
  };
}

describe('cartItemSchema', () => {
  it('accepts a minimal valid item', () => {
    expect(cartItemSchema.safeParse(baseItem()).success).toBe(true);
  });

  it('rejects quantity 0', () => {
    expect(cartItemSchema.safeParse(baseItem({ quantity: 0 })).success).toBe(false);
  });

  it('rejects quantity above 50 — the client cannot order past the cap', () => {
    expect(cartItemSchema.safeParse(baseItem({ quantity: 51 })).success).toBe(false);
  });

  it('rejects a non-integer quantity', () => {
    expect(cartItemSchema.safeParse(baseItem({ quantity: 1.5 })).success).toBe(false);
  });

  it('rejects an empty productId', () => {
    expect(cartItemSchema.safeParse(baseItem({ productId: '' })).success).toBe(false);
  });

  it('rejects an extra quantity above its own cap of 20', () => {
    const result = cartItemSchema.safeParse(
      baseItem({ selectedExtras: [{ extraId: 'extra-1', quantity: 21 }] }),
    );
    expect(result.success).toBe(false);
  });

  it('caps notes at 300 chars', () => {
    const result = cartItemSchema.safeParse(baseItem({ notes: 'a'.repeat(301) }));
    expect(result.success).toBe(false);
  });
});

describe('cartSchema', () => {
  it('rejects an empty cart — nothing to charge for', () => {
    expect(cartSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('accepts a cart with one item and no coupon', () => {
    expect(cartSchema.safeParse({ items: [baseItem()] }).success).toBe(true);
  });

  it('rejects more than 60 line items', () => {
    const items = Array.from({ length: 61 }, (_, i) => baseItem({ cartItemId: `cart-${i}` }));
    expect(cartSchema.safeParse({ items }).success).toBe(false);
  });
});
