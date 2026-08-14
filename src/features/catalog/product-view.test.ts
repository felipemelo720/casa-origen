import { describe, expect, it } from 'vitest';

import {
  entryPrice,
  initialSelection,
  largestAvailableOption,
  priceRange,
  selectionPrice,
  type ProductView,
  type ProductViewGroup,
  type ProductViewOption,
} from '@/features/catalog/product-view';

function option(partial: Partial<ProductViewOption> & { id: string }): ProductViewOption {
  return {
    name: partial.id,
    priceDelta: 0,
    extraPrice: null,
    extraPremiumPrice: null,
    isAvailable: true,
    ...partial,
  };
}

function group(id: string, options: ProductViewOption[], isRequired = true): ProductViewGroup {
  return { id, name: id, isRequired, options };
}

function product(partial: Partial<ProductView> = {}): ProductView {
  return {
    id: 'p1',
    slug: 'p1',
    name: 'Pepperoni',
    shortDescription: null,
    image: null,
    price: 5500,
    offerPrice: null,
    isAvailable: true,
    tags: [],
    groups: [],
    extras: [],
    ...partial,
  };
}

describe('largestAvailableOption', () => {
  it('picks the highest priceDelta among available options', () => {
    const options = [option({ id: '24', priceDelta: 0 }), option({ id: '32', priceDelta: 4500 })];
    expect(largestAvailableOption(options)?.id).toBe('32');
  });

  it('skips sold-out options instead of suggesting them', () => {
    const options = [
      option({ id: '24', priceDelta: 0 }),
      option({ id: '32', priceDelta: 4500, isAvailable: false }),
    ];
    expect(largestAvailableOption(options)?.id).toBe('24');
  });

  it('returns nothing when the whole group is sold out', () => {
    expect(largestAvailableOption([option({ id: '24', isAvailable: false })])).toBeUndefined();
  });
});

describe('initialSelection', () => {
  it('opens a size ladder on the biggest available option', () => {
    const sizes = group('sizes', [
      option({ id: '24', priceDelta: 0 }),
      option({ id: '32', priceDelta: 4500 }),
    ]);
    expect(initialSelection([sizes])).toEqual({ sizes: '32' });
  });

  it('leaves a flavour group empty: choosing for the customer picks their flavour', () => {
    const flavours = group('flavours', [
      option({ id: 'napolitana' }),
      option({ id: 'rustica' }),
      option({ id: 'huerta' }),
    ]);
    expect(initialSelection([flavours])).toEqual({});
  });

  it('handles both kinds at once (a combo with a paid size and a free flavour)', () => {
    const sizes = group('sizes', [
      option({ id: '24', priceDelta: 0 }),
      option({ id: '32', priceDelta: 4500 }),
    ]);
    const drinks = group('drinks', [option({ id: 'coca' }), option({ id: 'zero' })]);
    expect(initialSelection([sizes, drinks])).toEqual({ sizes: '32' });
  });
});

describe('selectionPrice', () => {
  it('adds every selected delta to the base', () => {
    expect(selectionPrice(5500, [option({ id: '32', priceDelta: 4500 })])).toBe(10000);
  });

  it('is the base itself when nothing is selected', () => {
    expect(selectionPrice(1200, [])).toBe(1200);
  });
});

describe('priceRange', () => {
  it('spans the cheapest and the dearest required option', () => {
    const withSizes = product({
      groups: [
        group('sizes', [
          option({ id: '24', priceDelta: 0 }),
          option({ id: '32', priceDelta: 4500 }),
        ]),
      ],
    });
    expect(priceRange(withSizes)).toEqual({ min: 5500, max: 10000 });
  });

  it('collapses to one figure for a product with no required groups', () => {
    expect(priceRange(product({ price: 1200 }))).toEqual({ min: 1200, max: 1200 });
  });

  it('anchors on offerPrice when there is one', () => {
    expect(priceRange(product({ price: 7200, offerPrice: 7000 }))).toEqual({
      min: 7000,
      max: 7000,
    });
  });

  it('ignores optional groups: they are add-ons, not the price of the product', () => {
    const withOptional = product({
      groups: [group('sauce', [option({ id: 'bbq', priceDelta: 900 })], false)],
    });
    expect(priceRange(withOptional)).toEqual({ min: 5500, max: 5500 });
  });
});

describe('entryPrice', () => {
  it('is the cheapest required option on top of the base', () => {
    const withSizes = product({
      groups: [
        group('sizes', [
          option({ id: '24', priceDelta: 0 }),
          option({ id: '32', priceDelta: 4500 }),
        ]),
      ],
    });
    expect(entryPrice(withSizes)).toBe(5500);
  });

  it('skips a sold-out size: the landing must not advertise a price the kitchen cannot serve', () => {
    const soldOutSmall = product({
      groups: [
        group('sizes', [
          option({ id: '24', priceDelta: 0, isAvailable: false }),
          option({ id: '32', priceDelta: 4500 }),
        ]),
      ],
    });
    expect(entryPrice(soldOutSmall)).toBe(10000);
    // El rango de la carta sigue contando el tamaño agotado: describe el menú.
    expect(priceRange(soldOutSmall).min).toBe(5500);
  });

  it('ignores optional groups and anchors on offerPrice', () => {
    const withOptional = product({
      price: 7200,
      offerPrice: 7000,
      groups: [group('sauce', [option({ id: 'bbq', priceDelta: 900 })], false)],
    });
    expect(entryPrice(withOptional)).toBe(7000);
  });
});
