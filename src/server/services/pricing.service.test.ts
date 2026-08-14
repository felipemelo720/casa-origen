import { beforeEach, describe, expect, it, vi } from 'vitest';

// `pricing.service.ts` is 'server-only' and talks to Prisma only through the
// repositories below — mock both boundaries so the pricing math runs in
// isolation, the way the client can never be trusted to run it.
vi.mock('server-only', () => ({}));

vi.mock('@/server/repositories/product.repository', () => ({
  productRepository: { findForPricing: vi.fn() },
}));

vi.mock('@/server/repositories/promotion.repository', () => ({
  promotionRepository: { findActive: vi.fn() },
  couponRepository: { findByCode: vi.fn(), countCustomerRedemptions: vi.fn() },
}));

vi.mock('@/server/repositories/operations.repository', () => ({
  communeRepository: { findById: vi.fn() },
  settingsRepository: { get: vi.fn() },
}));

import { priceCart } from './pricing.service';
import { productRepository } from '@/server/repositories/product.repository';
import { promotionRepository, couponRepository } from '@/server/repositories/promotion.repository';
import { communeRepository, settingsRepository } from '@/server/repositories/operations.repository';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import type { CartItemInput } from '@/schemas/cart.schema';

const findForPricing = vi.mocked(productRepository.findForPricing);
const findActivePromotions = vi.mocked(promotionRepository.findActive);
const findCommuneById = vi.mocked(communeRepository.findById);
const getSettings = vi.mocked(settingsRepository.get);
const findCouponByCode = vi.mocked(couponRepository.findByCode);
const countCustomerRedemptions = vi.mocked(couponRepository.countCustomerRedemptions);

/** Delivery zone quoted at $1.500 – $4.000, charged at the low end. */
function zone(overrides: Partial<{ deliveryFeeMin: number; deliveryFeeMax: number }> = {}) {
  const deliveryFeeMin = overrides.deliveryFeeMin ?? 1500;
  return {
    id: 'commune-1',
    name: 'Paine',
    isActive: true,
    minOrder: 0,
    deliveryFee: deliveryFeeMin,
    deliveryFeeMin,
    deliveryFeeMax: overrides.deliveryFeeMax ?? 4000,
  } as never;
}

/** Pizza with a required size group ($0 / +$2.000) and one premium extra.
 *  Add-on prices mirror the carta: $700/$1.200 standard, $1.000/$1.500 premium. */
function baseProduct() {
  return {
    id: 'prod-1',
    name: 'Pizza Margarita',
    price: 8000,
    offerPrice: null,
    isActive: true,
    availability: 'AVAILABLE' as const,
    categoryId: 'cat-pizza',
    variantGroups: [
      {
        id: 'group-size',
        name: 'Tamaño',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          {
            id: 'opt-24',
            name: '24 cm',
            priceDelta: 0,
            extraPrice: 700,
            extraPremiumPrice: 1000,
            isAvailable: true,
          },
          {
            id: 'opt-32',
            name: '32 cm',
            priceDelta: 2000,
            extraPrice: 1200,
            extraPremiumPrice: 1500,
            isAvailable: true,
          },
        ],
      },
    ],
    extras: [
      {
        extraId: 'extra-cheese',
        priceOverride: null,
        maxQuantity: 3,
        extra: {
          id: 'extra-cheese',
          name: 'Queso extra',
          price: 1500,
          isActive: true,
          isPremium: true,
        },
      },
      {
        extraId: 'extra-olive',
        priceOverride: null,
        maxQuantity: 3,
        extra: {
          id: 'extra-olive',
          name: 'Aceituna',
          price: 700,
          isActive: true,
          isPremium: false,
        },
      },
    ],
  };
}

function baseSettings() {
  return {
    id: 'singleton',
    minOrderAmount: 0,
    defaultDeliveryFee: 1500,
    freeDeliveryFrom: 0,
  } as Awaited<ReturnType<typeof settingsRepository.get>>;
}

function baseItem(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    cartItemId: 'cart-1',
    productId: 'prod-1',
    quantity: 1,
    selectedVariantOptionIds: ['opt-24'],
    selectedExtras: [],
    removedIngredientIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  findForPricing.mockResolvedValue(baseProduct() as never);
  findActivePromotions.mockResolvedValue([]);
  getSettings.mockResolvedValue(baseSettings());
});

describe('priceCart — line pricing', () => {
  it('prices base + required variant, ignoring whatever the client sent', async () => {
    const result = await priceCart({ items: [baseItem()], orderType: 'PICKUP' });
    expect(result.items[0]?.unitPrice).toBe(8000);
    expect(result.subtotal).toBe(8000);
    expect(result.total).toBe(8000);
  });

  it('multiplies unit price and extras by quantity', async () => {
    findForPricing.mockResolvedValue({
      ...baseProduct(),
      extras: [
        {
          extraId: 'extra-cheese',
          priceOverride: null,
          maxQuantity: 3,
          extra: {
            id: 'extra-cheese',
            name: 'Queso extra',
            price: 1500,
            isActive: true,
            isPremium: true,
          },
        },
      ],
    } as never);
    const item = baseItem({
      quantity: 2,
      selectedExtras: [{ extraId: 'extra-cheese', quantity: 1 }],
    });
    const result = await priceCart({ items: [item], orderType: 'PICKUP' });
    // Queso extra is premium, so the 24 cm option charges 1.000 for it and not
    // the 1.500 of the catalogue: (8000 unit + 1000 extra) * 2 = 18000
    expect(result.items[0]?.lineTotal).toBe(18000);
  });

  it('charges add-ons by the selected size, not the extra catalogue price', async () => {
    const item = baseItem({
      selectedVariantOptionIds: ['opt-32'],
      selectedExtras: [{ extraId: 'extra-cheese', quantity: 1 }],
    });
    const result = await priceCart({ items: [item], orderType: 'PICKUP' });
    expect(result.items[0]?.extras[0]?.unitPrice).toBe(1500); // not the catalogue price
    expect(result.items[0]?.unitPrice).toBe(10000); // 8000 base + 2000 size delta
  });

  it('charges the standard tier and the premium tier at their own prices', async () => {
    const small = await priceCart({
      items: [
        baseItem({
          selectedExtras: [
            { extraId: 'extra-olive', quantity: 1 },
            { extraId: 'extra-cheese', quantity: 1 },
          ],
        }),
      ],
      orderType: 'PICKUP',
    });
    expect(small.items[0]?.extras.map((e) => e.unitPrice)).toEqual([700, 1000]);

    const large = await priceCart({
      items: [
        baseItem({
          selectedVariantOptionIds: ['opt-32'],
          selectedExtras: [
            { extraId: 'extra-olive', quantity: 1 },
            { extraId: 'extra-cheese', quantity: 1 },
          ],
        }),
      ],
      orderType: 'PICKUP',
    });
    expect(large.items[0]?.extras.map((e) => e.unitPrice)).toEqual([1200, 1500]);
  });

  it('falls back to the standard price when the size does not split by tier', async () => {
    findForPricing.mockResolvedValue({
      ...baseProduct(),
      variantGroups: [
        {
          id: 'group-size',
          name: 'Tamaño',
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            {
              id: 'opt-24',
              name: '24 cm',
              priceDelta: 0,
              extraPrice: 700,
              extraPremiumPrice: null,
              isAvailable: true,
            },
          ],
        },
      ],
    } as never);
    const result = await priceCart({
      items: [baseItem({ selectedExtras: [{ extraId: 'extra-cheese', quantity: 1 }] })],
      orderType: 'PICKUP',
    });
    // A size with one add-on price charges it for everything — not a free premium.
    expect(result.items[0]?.extras[0]?.unitPrice).toBe(700);
  });

  it('rejects a product that no longer exists', async () => {
    findForPricing.mockResolvedValue(null);
    await expect(priceCart({ items: [baseItem()], orderType: 'PICKUP' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects a product that is out of stock', async () => {
    findForPricing.mockResolvedValue({ ...baseProduct(), availability: 'OUT_OF_STOCK' } as never);
    await expect(priceCart({ items: [baseItem()], orderType: 'PICKUP' })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it('rejects a cart missing a required variant selection', async () => {
    const item = baseItem({ selectedVariantOptionIds: [] });
    await expect(priceCart({ items: [item], orderType: 'PICKUP' })).rejects.toThrow(
      BusinessRuleError,
    );
  });
});

describe('priceCart — order minimum', () => {
  it('rejects a subtotal under the configured minimum', async () => {
    getSettings.mockResolvedValue({ ...baseSettings(), minOrderAmount: 20000 });
    await expect(priceCart({ items: [baseItem()], orderType: 'PICKUP' })).rejects.toThrow(
      BusinessRuleError,
    );
  });
});

describe('priceCart — promotions', () => {
  it('applies a percentage promotion capped by maxDiscount', async () => {
    findActivePromotions.mockResolvedValue([
      {
        id: 'promo-1',
        scope: 'ALL',
        minSubtotal: 0,
        discountType: 'PERCENTAGE',
        value: 50,
        maxDiscount: 2000,
        categories: [],
        products: [],
      },
    ] as never);
    const result = await priceCart({ items: [baseItem()], orderType: 'PICKUP' });
    // 50% of 8000 = 4000, capped at 2000
    expect(result.promotionDiscount).toBe(2000);
    expect(result.promotionId).toBe('promo-1');
    expect(result.total).toBe(6000);
  });
});

describe('priceCart — bundle promotions', () => {
  /** Promo Dúo: two 32 cm units for a flat 17990. */
  function duoPromo(overrides: Record<string, unknown> = {}) {
    return [
      {
        id: 'promo-duo',
        name: 'Promo Dúo',
        scope: 'ALL',
        minSubtotal: 0,
        discountType: 'BUNDLE_PRICE',
        value: 17990,
        bundleSize: 2,
        bundleVariantName: '32 cm',
        maxDiscount: null,
        categories: [],
        products: [],
        ...overrides,
      },
    ] as never;
  }

  /** One 32 cm pizza: 8000 base + 2000 size delta = 10000. */
  function large(cartItemId: string, quantity = 1): CartItemInput {
    return baseItem({ cartItemId, quantity, selectedVariantOptionIds: ['opt-32'] });
  }

  it('grants nothing while the bundle is incomplete', async () => {
    findActivePromotions.mockResolvedValue(duoPromo());
    const result = await priceCart({ items: [large('cart-1')], orderType: 'PICKUP' });
    expect(result.promotionDiscount).toBe(0);
    expect(result.promotionId).toBeNull();
    expect(result.total).toBe(10000);
  });

  it('charges the bundle price once the pair is complete', async () => {
    findActivePromotions.mockResolvedValue(duoPromo());
    const result = await priceCart({
      items: [large('cart-1'), large('cart-2')],
      orderType: 'PICKUP',
    });
    expect(result.promotionDiscount).toBe(2010);
    expect(result.promotionId).toBe('promo-duo');
    expect(result.total).toBe(17990);
  });

  it('pairs two units inside a single line', async () => {
    findActivePromotions.mockResolvedValue(duoPromo());
    const result = await priceCart({ items: [large('cart-1', 2)], orderType: 'PICKUP' });
    expect(result.promotionDiscount).toBe(2010);
    expect(result.total).toBe(17990);
  });

  it('ignores units that do not carry the bundle variant', async () => {
    findActivePromotions.mockResolvedValue(duoPromo());
    // Two 24 cm pizzas: same product, wrong size.
    const result = await priceCart({
      items: [baseItem({ cartItemId: 'cart-1' }), baseItem({ cartItemId: 'cart-2' })],
      orderType: 'PICKUP',
    });
    expect(result.promotionDiscount).toBe(0);
    expect(result.total).toBe(16000);
  });

  it('charges extras on top of the bundle price', async () => {
    findActivePromotions.mockResolvedValue(duoPromo());
    const withExtra = baseItem({
      cartItemId: 'cart-1',
      selectedVariantOptionIds: ['opt-32'],
      selectedExtras: [{ extraId: 'extra-cheese', quantity: 1 }],
    });
    const result = await priceCart({ items: [withExtra, large('cart-2')], orderType: 'PICKUP' });
    // 10000 + 1500 (queso extra, premium a 32 cm) + 10000 = 21500, menos los
    // 2010 del par. El extra no entra al precio del paquete: se cobra encima.
    expect(result.subtotal).toBe(21500);
    expect(result.promotionDiscount).toBe(2010);
    expect(result.total).toBe(19490);
  });

  it('does not block a lower-priority promotion when no bundle completes', async () => {
    // The bundle sorts first (higher priority) but only one 32 cm is in the
    // cart, so the percentage promotion behind it must still apply.
    findActivePromotions.mockResolvedValue([
      ...(duoPromo() as unknown as Record<string, unknown>[]),
      {
        id: 'promo-fallback',
        name: '10%',
        scope: 'ALL',
        minSubtotal: 0,
        discountType: 'PERCENTAGE',
        value: 10,
        maxDiscount: null,
        bundleSize: 0,
        bundleVariantName: null,
        categories: [],
        products: [],
      },
    ] as never);

    const result = await priceCart({ items: [large('cart-1')], orderType: 'PICKUP' });
    expect(result.promotionId).toBe('promo-fallback');
    expect(result.promotionDiscount).toBe(1000);
  });

  it('honours a product allow-list on the bundle', async () => {
    findActivePromotions.mockResolvedValue(
      duoPromo({ scope: 'PRODUCT', products: [{ productId: 'another-product' }] }),
    );
    const result = await priceCart({
      items: [large('cart-1'), large('cart-2')],
      orderType: 'PICKUP',
    });
    expect(result.promotionDiscount).toBe(0);
    expect(result.total).toBe(20000);
  });
});

describe('priceCart — combo product', () => {
  /**
   * Combo Individual: a hidden product sold at a flat `offerPrice`, with one
   * required group per decision and every delta at zero.
   *
   * The point of these tests is that the combo is priced by the ordinary
   * product path and owes nothing to the promotion engine — no `BUNDLE_PRICE`,
   * no promotion slot, no `break` to compete for.
   */
  function comboProduct(overrides: Record<string, unknown> = {}) {
    return {
      id: 'combo-individual',
      name: 'Combo Individual',
      price: 7200,
      offerPrice: 7000,
      isActive: true,
      availability: 'AVAILABLE' as const,
      categoryId: 'cat-promos',
      variantGroups: [
        {
          id: 'group-pizza',
          name: 'Elige tu pizza',
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            {
              id: 'opt-napolitana',
              name: 'Napolitana',
              priceDelta: 0,
              extraPrice: null,
              extraPremiumPrice: null,
              isAvailable: true,
            },
            {
              id: 'opt-rustica',
              name: 'Rústica',
              priceDelta: 0,
              extraPrice: null,
              extraPremiumPrice: null,
              isAvailable: true,
            },
          ],
        },
        {
          id: 'group-drink',
          name: 'Elige tu bebida',
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            {
              id: 'opt-coca',
              name: 'Coca-Cola',
              priceDelta: 0,
              extraPrice: null,
              extraPremiumPrice: null,
              isAvailable: true,
            },
          ],
        },
      ],
      extras: [],
      ...overrides,
    };
  }

  function comboItem(overrides: Partial<CartItemInput> = {}): CartItemInput {
    return baseItem({
      productId: 'combo-individual',
      selectedVariantOptionIds: ['opt-napolitana', 'opt-coca'],
      ...overrides,
    });
  }

  beforeEach(() => {
    findForPricing.mockResolvedValue(comboProduct() as never);
  });

  it('charges the offer price and not the list price', async () => {
    const result = await priceCart({ items: [comboItem()], orderType: 'PICKUP' });

    expect(result.items[0]?.unitPrice).toBe(7000);
    expect(result.total).toBe(7000);
  });

  it('charges the same for every allowed combination', async () => {
    const result = await priceCart({
      items: [comboItem({ selectedVariantOptionIds: ['opt-rustica', 'opt-coca'] })],
      orderType: 'PICKUP',
    });

    expect(result.total).toBe(7000);
  });

  it('rejects a combo missing one of its required decisions', async () => {
    // The sheet keeps the button disabled until both groups are resolved, but
    // hiding it in the UI is not validating it: a hand-made payload with only
    // the pizza has to bounce server-side.
    // Anclado al motivo y no sólo al tipo: `BusinessRuleError` también sale por
    // pedido mínimo y por producto inactivo, así que un `toThrow` pelado pasaría
    // aunque el combo se rechazara por la razón equivocada.
    await expect(
      priceCart({
        items: [comboItem({ selectedVariantOptionIds: ['opt-napolitana'] })],
        orderType: 'PICKUP',
      }),
    ).rejects.toThrow(/Completa la selección/i);
  });

  it('rejects a flavour that is not on the combo', async () => {
    // The allow-list is the option rows themselves, so asking for a pizza the
    // combo does not carry is not a cheap Mechada — it is an error.
    await expect(
      priceCart({
        items: [comboItem({ selectedVariantOptionIds: ['opt-mechada', 'opt-coca'] })],
        orderType: 'PICKUP',
      }),
    ).rejects.toThrow(/Una de las opciones/i);
  });

  it('multiplies by quantity', async () => {
    const result = await priceCart({ items: [comboItem({ quantity: 3 })], orderType: 'PICKUP' });

    expect(result.total).toBe(21000);
  });

  it('does not consume the promotion slot', async () => {
    // The whole reason the combo is a product: a cart holding it can still take
    // an unrelated promotion, because it never entered the `break` loop as one.
    findActivePromotions.mockResolvedValue([
      {
        id: 'promo-flat',
        name: 'Descuento plano',
        scope: 'ALL',
        minSubtotal: 0,
        discountType: 'FIXED',
        value: 500,
        bundleSize: 0,
        bundleVariantName: null,
        maxDiscount: null,
        categories: [],
        products: [],
      },
    ] as never);

    const result = await priceCart({ items: [comboItem()], orderType: 'PICKUP' });

    expect(result.promotionId).toBe('promo-flat');
    expect(result.promotionDiscount).toBe(500);
    expect(result.total).toBe(6500);
  });

  it('is invisible to the Promo Dúo bundle rule', async () => {
    // Its options are named "Napolitana" and "Coca-Cola", never "32 cm", so the
    // bundle matcher cannot pair two combos into a dúo and discount them twice.
    findActivePromotions.mockResolvedValue([
      {
        id: 'promo-duo',
        name: 'Promo Dúo',
        scope: 'ALL',
        minSubtotal: 0,
        discountType: 'BUNDLE_PRICE',
        value: 17990,
        bundleSize: 2,
        bundleVariantName: '32 cm',
        maxDiscount: null,
        categories: [],
        products: [],
      },
    ] as never);

    const result = await priceCart({ items: [comboItem({ quantity: 2 })], orderType: 'PICKUP' });

    expect(result.promotionDiscount).toBe(0);
    expect(result.promotionId).toBeNull();
    expect(result.total).toBe(14000);
  });
});

describe('priceCart — delivery', () => {
  it('requires a commune for delivery orders', async () => {
    await expect(priceCart({ items: [baseItem()], orderType: 'DELIVERY' })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it('waives the delivery fee once the subtotal clears freeDeliveryFrom', async () => {
    getSettings.mockResolvedValue({ ...baseSettings(), freeDeliveryFrom: 5000 });
    findCommuneById.mockResolvedValue(zone());
    const result = await priceCart({
      items: [baseItem()],
      orderType: 'DELIVERY',
      communeId: 'commune-1',
    });
    expect(result.deliveryFee).toBe(0);
    expect(result.total).toBe(8000);
    // The advertised band collapses with the charge: showing a range next to a
    // $0 delivery would contradict the total right below it.
    expect(result.deliveryFeeMax).toBe(0);
  });

  it('charges the low end of the band and advertises the high end', async () => {
    findCommuneById.mockResolvedValue(zone());
    const result = await priceCart({
      items: [baseItem()],
      orderType: 'DELIVERY',
      communeId: 'commune-1',
    });
    expect(result.deliveryFee).toBe(1500);
    expect(result.deliveryFeeMin).toBe(1500);
    expect(result.deliveryFeeMax).toBe(4000);
    expect(result.total).toBe(9500);
  });

  it('never advertises a ceiling below what it charges', async () => {
    // A zone migrated before the range existed: both ends still sit at 0.
    findCommuneById.mockResolvedValue(zone({ deliveryFeeMin: 0, deliveryFeeMax: 0 }));
    const result = await priceCart({
      items: [baseItem()],
      orderType: 'DELIVERY',
      communeId: 'commune-1',
    });
    expect(result.deliveryFeeMax).toBe(result.deliveryFee);
  });

  it('leaves pickup orders with no fee and no band', async () => {
    const result = await priceCart({ items: [baseItem()], orderType: 'PICKUP' });
    expect(result.deliveryFee).toBe(0);
    expect(result.deliveryFeeMax).toBe(0);
  });
});

describe('priceCart — coupons', () => {
  it('rejects an unknown or expired coupon code', async () => {
    findCouponByCode.mockResolvedValue(null);
    await expect(
      priceCart({ items: [baseItem()], orderType: 'PICKUP', couponCode: 'NOPE' }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it('keeps only the larger of promotion vs. coupon discount', async () => {
    findActivePromotions.mockResolvedValue([
      {
        id: 'promo-1',
        scope: 'ALL',
        minSubtotal: 0,
        discountType: 'FIXED',
        value: 1000,
        maxDiscount: null,
        categories: [],
        products: [],
      },
    ] as never);
    findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      isActive: true,
      startsAt: new Date('2020-01-01'),
      endsAt: null,
      minSubtotal: 0,
      usageLimit: null,
      usageCount: 0,
      perCustomerLimit: 1,
      discountType: 'FIXED',
      value: 3000,
      maxDiscount: null,
      freeDelivery: false,
    } as never);
    countCustomerRedemptions.mockResolvedValue(0);

    const result = await priceCart({
      items: [baseItem()],
      orderType: 'PICKUP',
      couponCode: 'BIGGER',
    });
    expect(result.couponDiscount).toBe(3000);
    expect(result.couponId).toBe('coupon-1');
    expect(result.promotionDiscount).toBe(0);
    expect(result.total).toBe(5000);
  });
});
