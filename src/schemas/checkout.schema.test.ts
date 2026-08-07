import { describe, expect, it } from 'vitest';
import { checkoutSchema } from './checkout.schema';

const validCart = {
  items: [
    {
      cartItemId: 'cart-1',
      productId: 'prod-1',
      quantity: 1,
      selectedVariantOptionIds: [],
      selectedExtras: [],
      removedIngredientIds: [],
    },
  ],
};

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    cart: validCart,
    orderType: 'PICKUP',
    firstName: 'Juan',
    lastName: 'Pérez',
    phone: '+56912345678',
    paymentMethodId: 'pm-1',
    ...overrides,
  };
}

describe('checkoutSchema — pickup', () => {
  it('accepts a minimal valid pickup order', () => {
    const result = checkoutSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it('does not require street/commune for pickup', () => {
    const result = checkoutSchema.safeParse(baseInput({ street: undefined, communeId: undefined }));
    expect(result.success).toBe(true);
  });
});

describe('checkoutSchema — delivery', () => {
  it('requires street and commune', () => {
    const result = checkoutSchema.safeParse(baseInput({ orderType: 'DELIVERY' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('street');
      expect(paths).toContain('communeId');
    }
  });

  it('accepts delivery with street and commune present', () => {
    const result = checkoutSchema.safeParse(
      baseInput({ orderType: 'DELIVERY', street: 'Calle Falsa 123', communeId: 'commune-1' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a street shorter than 5 chars', () => {
    const result = checkoutSchema.safeParse(
      baseInput({ orderType: 'DELIVERY', street: 'abc', communeId: 'commune-1' }),
    );
    expect(result.success).toBe(false);
  });
});

describe('checkoutSchema — field validation', () => {
  it('rejects an invalid phone', () => {
    const result = checkoutSchema.safeParse(baseInput({ phone: 'not-a-phone' }));
    expect(result.success).toBe(false);
  });

  it('accepts a Chilean mobile without country code', () => {
    const result = checkoutSchema.safeParse(baseInput({ phone: '912345678' }));
    expect(result.success).toBe(true);
  });

  it('rejects a one-letter first name', () => {
    const result = checkoutSchema.safeParse(baseInput({ firstName: 'A' }));
    expect(result.success).toBe(false);
  });

  it('rejects a missing payment method', () => {
    const result = checkoutSchema.safeParse(baseInput({ paymentMethodId: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects negative cash given', () => {
    const result = checkoutSchema.safeParse(baseInput({ cashGiven: -100 }));
    expect(result.success).toBe(false);
  });

  it('accepts an empty-string email (optional field, not omitted)', () => {
    const result = checkoutSchema.safeParse(baseInput({ email: '' }));
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = checkoutSchema.safeParse(baseInput({ email: 'not-an-email' }));
    expect(result.success).toBe(false);
  });
});
