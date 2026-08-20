import { beforeEach, describe, expect, it } from 'vitest';

import { useCartStore, type CartLine } from '@/features/cart/cart-store';
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from '@/schemas/cart.schema';

function line(overrides: Partial<CartLine> = {}): Omit<CartLine, 'cartItemId'> {
  return {
    productId: 'prod-1',
    name: 'Pepperoni',
    image: null,
    basePrice: 9990,
    quantity: 1,
    variants: [],
    extras: [],
    removedIngredientIds: [],
    removedIngredientNames: [],
    ...overrides,
  };
}

describe('cart-store: topes', () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [], couponCode: undefined });
  });

  it('acepta líneas hasta el tope y rechaza la siguiente', () => {
    for (let i = 0; i < MAX_CART_LINES; i++) {
      expect(useCartStore.getState().addLine(line({ productId: `prod-${i}` }))).toBe(true);
    }
    expect(useCartStore.getState().addLine(line())).toBe(false);
    expect(useCartStore.getState().lines).toHaveLength(MAX_CART_LINES);
  });

  it('recorta la cantidad de una línea nueva al tope del schema', () => {
    useCartStore.getState().addLine(line({ quantity: MAX_LINE_QUANTITY + 10 }));
    expect(useCartStore.getState().lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('recorta setQuantity al tope en vez de dejar pasar el valor', () => {
    useCartStore.getState().addLine(line());
    const id = useCartStore.getState().lines[0]?.cartItemId ?? '';
    useCartStore.getState().setQuantity(id, 9999);
    expect(useCartStore.getState().lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('setQuantity en 0 sigue borrando la línea', () => {
    useCartStore.getState().addLine(line());
    const id = useCartStore.getState().lines[0]?.cartItemId ?? '';
    useCartStore.getState().setQuantity(id, 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });
});
