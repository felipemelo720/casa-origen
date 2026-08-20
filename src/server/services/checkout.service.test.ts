import { beforeEach, describe, expect, it, vi } from 'vitest';

// checkout.service orchestrates pricing + schedule + several repositories
// inside one transaction. Every collaborator is mocked so this file tests
// only checkout.service's own orchestration logic — pricing math is covered
// separately in pricing.service.test.ts, open/closed logic in
// schedule.service.test.ts.
vi.mock('server-only', () => ({}));

vi.mock('@/server/services/pricing.service', () => ({ priceCart: vi.fn() }));
vi.mock('@/server/services/schedule.service', () => ({ getOpenState: vi.fn() }));
// Mocked for its import chain as much as for its behaviour: the real module
// pulls in the session helpers, which parse the server env at import time.
vi.mock('@/server/services/customer-auth.service', () => ({
  getCurrentCustomer: vi.fn(async () => null),
}));

vi.mock('@/server/repositories/order.repository', () => ({
  orderRepository: {
    create: vi.fn(),
    appendHistory: vi.fn(),
    incrementProductSoldCount: vi.fn(),
  },
}));

vi.mock('@/server/repositories/counter.repository', () => ({
  counterRepository: { next: vi.fn() },
}));

vi.mock('@/server/repositories/customer.repository', () => ({
  customerRepository: { upsertByPhone: vi.fn(), recordOrder: vi.fn() },
}));

vi.mock('@/server/repositories/promotion.repository', () => ({
  couponRepository: { consumeUsage: vi.fn(async () => true), createRedemption: vi.fn() },
}));

vi.mock('@/server/repositories/operations.repository', () => ({
  communeRepository: { findById: vi.fn() },
  paymentMethodRepository: { findById: vi.fn() },
  settingsRepository: { get: vi.fn() },
}));

vi.mock('@/server/repositories/transaction.repository', () => ({
  withTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
}));

import { placeOrder } from './checkout.service';
import { priceCart } from '@/server/services/pricing.service';
import { getOpenState } from '@/server/services/schedule.service';
import { orderRepository } from '@/server/repositories/order.repository';
import { counterRepository } from '@/server/repositories/counter.repository';
import { customerRepository } from '@/server/repositories/customer.repository';
import { couponRepository } from '@/server/repositories/promotion.repository';
import {
  communeRepository,
  paymentMethodRepository,
  settingsRepository,
} from '@/server/repositories/operations.repository';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import type { CheckoutInput } from '@/schemas/checkout.schema';
import type { PricedCart } from './pricing.service';

const mockedPriceCart = vi.mocked(priceCart);
const mockedGetOpenState = vi.mocked(getOpenState);
const createOrder = vi.mocked(orderRepository.create);
const appendHistory = vi.mocked(orderRepository.appendHistory);
const incrementSoldCount = vi.mocked(orderRepository.incrementProductSoldCount);
const counterNext = vi.mocked(counterRepository.next);
const upsertByPhone = vi.mocked(customerRepository.upsertByPhone);
const recordOrder = vi.mocked(customerRepository.recordOrder);
const consumeCouponUsage = vi.mocked(couponRepository.consumeUsage);
const createRedemption = vi.mocked(couponRepository.createRedemption);
const findCommuneById = vi.mocked(communeRepository.findById);
const findPaymentMethodById = vi.mocked(paymentMethodRepository.findById);
const getSettings = vi.mocked(settingsRepository.get);

function pricedCart(overrides: Partial<PricedCart> = {}): PricedCart {
  return {
    items: [
      {
        cartItemId: 'cart-1',
        productId: 'prod-1',
        categoryId: 'cat-pizza',
        name: 'Pizza Margarita',
        quantity: 1,
        unitPrice: 8000,
        lineTotal: 8000,
        removedIngredientNames: [],
        variants: [],
        extras: [],
      },
    ],
    subtotal: 8000,
    promotionDiscount: 0,
    promotionId: null,
    couponDiscount: 0,
    couponId: null,
    appliedCoupon: null,
    deliveryFee: 0,
    deliveryFeeMin: 0,
    deliveryFeeMax: 0,
    total: 8000,
    ...overrides,
  };
}

function baseInput(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    cart: { items: [] },
    orderType: 'PICKUP',
    firstName: 'Juan',
    lastName: 'Pérez',
    phone: '+56912345678',
    paymentMethodId: 'pm-cash',
    ...overrides,
  } as CheckoutInput;
}

const cashMethod = {
  id: 'pm-cash',
  code: 'CASH',
  name: 'Efectivo',
  isActive: true,
  requiresChange: true,
};

const cardMethod = {
  id: 'pm-card',
  code: 'CARD',
  name: 'Tarjeta',
  isActive: true,
  requiresChange: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetOpenState.mockResolvedValue({ isOpen: true });
  getSettings.mockResolvedValue({
    deliveryEnabled: true,
    deliveryEtaMinutes: 45,
    pickupEtaMinutes: 20,
  } as never);
  mockedPriceCart.mockResolvedValue(pricedCart());
  counterNext.mockResolvedValue(1);
  upsertByPhone.mockResolvedValue({ id: 'customer-1' } as never);
  createOrder.mockResolvedValue({ id: 'order-1' } as never);
  appendHistory.mockResolvedValue({} as never);
  incrementSoldCount.mockResolvedValue({} as never);
  recordOrder.mockResolvedValue({} as never);
});

describe('placeOrder — store gate', () => {
  it('refuses an order while the store is closed, before touching pricing', async () => {
    mockedGetOpenState.mockResolvedValue({ isOpen: false, reason: 'Cerrado por hoy.' });
    await expect(placeOrder(baseInput())).rejects.toThrow(BusinessRuleError);
    expect(mockedPriceCart).not.toHaveBeenCalled();
  });

  it('refuses delivery when deliveryEnabled is off, even with the store open', async () => {
    getSettings.mockResolvedValue({
      deliveryEnabled: false,
      deliveryEtaMinutes: 45,
      pickupEtaMinutes: 20,
    } as never);
    await expect(
      placeOrder(baseInput({ orderType: 'DELIVERY', communeId: 'commune-1', street: 'Calle 123' })),
    ).rejects.toThrow(BusinessRuleError);
  });
});

describe('placeOrder — payment method', () => {
  it('rejects an unknown payment method', async () => {
    findPaymentMethodById.mockResolvedValue(null);
    await expect(placeOrder(baseInput())).rejects.toThrow(NotFoundError);
  });

  it('rejects a deactivated payment method', async () => {
    findPaymentMethodById.mockResolvedValue({ ...cashMethod, isActive: false } as never);
    await expect(placeOrder(baseInput())).rejects.toThrow(NotFoundError);
  });

  it('requires cashGiven when the method requires change', async () => {
    findPaymentMethodById.mockResolvedValue(cashMethod as never);
    await expect(placeOrder(baseInput({ cashGiven: undefined }))).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it('rejects cash given below the priced total', async () => {
    findPaymentMethodById.mockResolvedValue(cashMethod as never);
    mockedPriceCart.mockResolvedValue(pricedCart({ total: 8000 }));
    await expect(placeOrder(baseInput({ cashGiven: 5000 }))).rejects.toThrow(BusinessRuleError);
  });

  it('does not require cashGiven for a method that does not need change', async () => {
    findPaymentMethodById.mockResolvedValue(cardMethod as never);
    await expect(placeOrder(baseInput())).resolves.toBeDefined();
  });
});

describe('placeOrder — happy path (pickup)', () => {
  beforeEach(() => {
    findPaymentMethodById.mockResolvedValue(cashMethod as never);
    mockedPriceCart.mockResolvedValue(pricedCart({ total: 8000 }));
  });

  it('computes change due from cash given', async () => {
    await placeOrder(baseInput({ cashGiven: 10000 }));
    const orderData = createOrder.mock.calls[0]?.[0];
    expect(orderData?.cashGiven).toBe(10000);
    expect(orderData?.changeDue).toBe(2000);
  });

  it('stamps the order code as CO-YYMMDD-NNNN using the counter sequence', async () => {
    counterNext.mockResolvedValue(42);
    await placeOrder(baseInput({ cashGiven: 10000 }));
    const orderData = createOrder.mock.calls[0]?.[0];
    expect(orderData?.code).toMatch(/^CO-\d{6}-0042$/);
  });

  it('uses pickupEtaMinutes for a pickup order', async () => {
    await placeOrder(baseInput({ cashGiven: 10000 }));
    const orderData = createOrder.mock.calls[0]?.[0];
    expect(orderData?.estimatedMinutes).toBe(20);
  });

  it('records history, sold-count and customer totals after creating the order', async () => {
    await placeOrder(baseInput({ cashGiven: 10000 }));
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: 'NEW' }),
      expect.anything(),
    );
    expect(incrementSoldCount).toHaveBeenCalledWith('prod-1', 1, expect.anything());
    expect(recordOrder).toHaveBeenCalledWith('customer-1', 8000, expect.anything());
  });

  it('never touches coupon redemption when no coupon was applied', async () => {
    await placeOrder(baseInput({ cashGiven: 10000 }));
    expect(consumeCouponUsage).not.toHaveBeenCalled();
    expect(createRedemption).not.toHaveBeenCalled();
  });

  it('sanitizes free-text fields before they reach the repository', async () => {
    await placeOrder(
      baseInput({
        cashGiven: 10000,
        firstName: '  Juan   Andrés  ',
        notes: 'sin  cebolla\ncon orégano',
      }),
    );
    const orderData = createOrder.mock.calls[0]?.[0];
    expect(orderData?.firstName).toBe('Juan Andrés');
  });
});

describe('placeOrder — happy path (delivery)', () => {
  beforeEach(() => {
    findPaymentMethodById.mockResolvedValue(cardMethod as never);
    findCommuneById.mockResolvedValue({
      id: 'commune-1',
      name: 'Paine',
      extraMinutes: 15,
    } as never);
    mockedPriceCart.mockResolvedValue(pricedCart({ total: 9500, deliveryFee: 1500 }));
  });

  it('adds the commune extraMinutes on top of deliveryEtaMinutes', async () => {
    await placeOrder(
      baseInput({ orderType: 'DELIVERY', communeId: 'commune-1', street: 'Calle 123' }),
    );
    const orderData = createOrder.mock.calls[0]?.[0];
    expect(orderData?.estimatedMinutes).toBe(60); // 45 + 15
  });

  it('connects the commune on the created order', async () => {
    await placeOrder(
      baseInput({ orderType: 'DELIVERY', communeId: 'commune-1', street: 'Calle 123' }),
    );
    const orderData = createOrder.mock.calls[0]?.[0];
    expect(orderData?.communeName).toBe('Paine');
  });
});

describe('placeOrder — coupons', () => {
  it('redeems the coupon inside the same transaction when priceCart applied one', async () => {
    findPaymentMethodById.mockResolvedValue(cardMethod as never);
    mockedPriceCart.mockResolvedValue(
      pricedCart({ couponId: 'coupon-1', couponDiscount: 1000, total: 7000 }),
    );
    consumeCouponUsage.mockResolvedValue(true);
    await placeOrder(baseInput({ cart: { items: [], couponCode: 'PROMO' } }));
    expect(consumeCouponUsage).toHaveBeenCalledWith('coupon-1', expect.anything());
    expect(createRedemption).toHaveBeenCalledWith(
      expect.objectContaining({ discountAmount: 1000, customerId: 'customer-1' }),
      expect.anything(),
    );
  });

  it('aborts the order when the coupon ran out between the quote and the write', async () => {
    findPaymentMethodById.mockResolvedValue(cardMethod as never);
    mockedPriceCart.mockResolvedValue(
      pricedCart({ couponId: 'coupon-1', couponDiscount: 1000, total: 7000 }),
    );
    consumeCouponUsage.mockResolvedValue(false);

    await expect(
      placeOrder(baseInput({ cart: { items: [], couponCode: 'PROMO' } })),
    ).rejects.toThrow(BusinessRuleError);
    expect(createRedemption).not.toHaveBeenCalled();
  });
});
