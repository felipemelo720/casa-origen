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

/** Pizza with a required size group ($0 / +$2.000) and one extra ($1.500). */
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
          { id: 'opt-24', name: '24 cm', priceDelta: 0, extraPrice: 700, isAvailable: true },
          { id: 'opt-32', name: '32 cm', priceDelta: 2000, extraPrice: 1000, isAvailable: true },
        ],
      },
    ],
    extras: [
      {
        extraId: 'extra-cheese',
        priceOverride: null,
        maxQuantity: 3,
        extra: { id: 'extra-cheese', name: 'Queso extra', price: 1500, isActive: true },
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
          extra: { id: 'extra-cheese', name: 'Queso extra', price: 1500, isActive: true },
        },
      ],
    } as never);
    const item = baseItem({
      quantity: 2,
      selectedExtras: [{ extraId: 'extra-cheese', quantity: 1 }],
    });
    const result = await priceCart({ items: [item], orderType: 'PICKUP' });
    // The default 24cm option carries its own extraPrice (700), which wins
    // over the extra's catalogue price (1500): (8000 unit + 700 extra) * 2 = 17400
    expect(result.items[0]?.lineTotal).toBe(17400);
  });

  it('charges add-ons by the selected size, not the extra catalogue price', async () => {
    const item = baseItem({
      selectedVariantOptionIds: ['opt-32'], // carries extraPrice: 1000
      selectedExtras: [{ extraId: 'extra-cheese', quantity: 1 }],
    });
    const result = await priceCart({ items: [item], orderType: 'PICKUP' });
    expect(result.items[0]?.extras[0]?.unitPrice).toBe(1000); // not the 1500 catalogue price
    expect(result.items[0]?.unitPrice).toBe(10000); // 8000 base + 2000 size delta
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
