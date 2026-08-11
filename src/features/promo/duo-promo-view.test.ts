import { describe, expect, it } from 'vitest';

import { buildDuoPromoView, toBundleRule } from './duo-promo-view';
import type { ProductDetail } from '@/server/repositories/product.repository';

function bundle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-duo',
    name: 'Promo Dúo',
    description: 'Dos pizzas de 32 cm por un solo precio.',
    value: 17990,
    scope: 'CATEGORY' as const,
    bundleSize: 2,
    bundleVariantName: '32 cm',
    bundleSizeLabel: '32 cm',
    image: '/hero/margarita.jpg',
    products: [] as { productId: string }[],
    ...overrides,
  };
}

/** Pizza with the two sizes the carta sells. */
function pizza(
  id: string,
  price: number,
  deltaTo32: number,
  overrides: Partial<{ availability: string; largeAvailable: boolean; categorySlug: string }> = {},
) {
  return {
    id,
    name: id,
    shortDescription: `Descripción de ${id}`,
    image: `/menu/${id}.jpg`,
    price,
    offerPrice: null,
    availability: overrides.availability ?? 'AVAILABLE',
    category: { id: 'cat', name: 'Pizzas', slug: overrides.categorySlug ?? 'pizzas', sortOrder: 0 },
    variantGroups: [
      {
        id: `${id}-size`,
        options: [
          { id: `${id}-24`, name: '24 cm', priceDelta: 0, extraPrice: 700, isAvailable: true },
          {
            id: `${id}-32`,
            name: '32 cm',
            priceDelta: deltaTo32,
            extraPrice: 1000,
            isAvailable: overrides.largeAvailable ?? true,
          },
        ],
      },
    ],
  } as unknown as ProductDetail;
}

function drink(id: string, price: number) {
  return {
    id,
    name: id,
    shortDescription: null,
    image: `/menu/${id}.jpg`,
    price,
    offerPrice: null,
    availability: 'AVAILABLE',
    category: { id: 'cat-drinks', name: 'Bebidas', slug: 'bebidas', sortOrder: 1 },
    variantGroups: [],
  } as unknown as ProductDetail;
}

describe('buildDuoPromoView', () => {
  it('returns null without a promotion', () => {
    expect(buildDuoPromoView(null, [pizza('pepperoni', 5500, 4500)])).toBeNull();
  });

  it('returns null when the promotion has no bundle variant configured', () => {
    const view = buildDuoPromoView(bundle({ bundleVariantName: null }), [
      pizza('pepperoni', 5500, 4500),
    ]);
    expect(view).toBeNull();
  });

  it('returns null when nothing on the menu can fill the bundle', () => {
    // Drinks only: no product carries a "32 cm" option.
    expect(buildDuoPromoView(bundle(), [drink('coca', 1200)])).toBeNull();
  });

  it('resolves each option at the bundle size', () => {
    const view = buildDuoPromoView(bundle(), [pizza('pepperoni', 5500, 4500)]);
    expect(view?.options).toHaveLength(1);
    expect(view?.options[0]?.optionId).toBe('pepperoni-32');
    expect(view?.options[0]?.unitPrice).toBe(10000);
    expect(view?.options[0]?.priceDelta).toBe(4500);
  });

  it('anchors on the cheapest complete bundle', () => {
    const view = buildDuoPromoView(bundle(), [
      pizza('mechada', 7500, 5000), // 12500
      pizza('pepperoni', 5500, 4500), // 10000
    ]);
    // The same pizza can fill both slots, so the floor is twice the cheapest.
    expect(view?.regularFrom).toBe(20000);
  });

  it('keeps sold-out pizzas in the list, marked unavailable', () => {
    const view = buildDuoPromoView(bundle(), [
      pizza('pepperoni', 5500, 4500),
      pizza('rustica', 6000, 4000, { availability: 'OUT_OF_STOCK' }),
    ]);
    expect(view?.options).toHaveLength(2);
    expect(view?.options.find((o) => o.productId === 'rustica')?.available).toBe(false);
  });

  it('treats an unavailable size as an unavailable option', () => {
    const view = buildDuoPromoView(bundle(), [
      pizza('pepperoni', 5500, 4500),
      pizza('rustica', 6000, 4000, { largeAvailable: false }),
    ]);
    expect(view?.options.find((o) => o.productId === 'rustica')?.available).toBe(false);
  });

  it('returns null when every option is unavailable', () => {
    const view = buildDuoPromoView(bundle(), [
      pizza('pepperoni', 5500, 4500, { availability: 'OUT_OF_STOCK' }),
    ]);
    expect(view).toBeNull();
  });

  it('honours a product allow-list', () => {
    const view = buildDuoPromoView(
      bundle({ scope: 'PRODUCT', products: [{ productId: 'pepperoni' }] }),
      [pizza('pepperoni', 5500, 4500), pizza('mechada', 7500, 5000)],
    );
    expect(view?.options.map((option) => option.productId)).toEqual(['pepperoni']);
  });

  it('offers drinks from the drinks category only', () => {
    const view = buildDuoPromoView(bundle(), [
      pizza('pepperoni', 5500, 4500),
      drink('coca', 1200),
      drink('sprite', 1200),
    ]);
    expect(view?.drinks.map((d) => d.productId)).toEqual(['coca', 'sprite']);
  });
});

describe('toBundleRule', () => {
  it('is null without a promotion', () => {
    expect(toBundleRule(null)).toBeNull();
  });

  it('leaves the product list empty for a category-scoped bundle', () => {
    expect(toBundleRule(bundle())?.eligibleProductIds).toEqual([]);
  });

  it('carries the product list for a product-scoped bundle', () => {
    const rule = toBundleRule(bundle({ scope: 'PRODUCT', products: [{ productId: 'pepperoni' }] }));
    expect(rule?.eligibleProductIds).toEqual(['pepperoni']);
  });

  it('mirrors what the pricing engine matches on', () => {
    const rule = toBundleRule(bundle());
    expect(rule).toMatchObject({ bundlePrice: 17990, bundleSize: 2, variantName: '32 cm' });
  });
});
