'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';

import { publicAction } from '@/server/actions/action-builder';
import { checkoutSchema } from '@/schemas/checkout.schema';
import { cartSchema } from '@/schemas/cart.schema';
import { placeOrder } from '@/server/services/checkout.service';
import { priceCart } from '@/server/services/pricing.service';
import {
  communeRepository,
  paymentMethodRepository,
  settingsRepository,
} from '@/server/repositories/operations.repository';

/**
 * Communes, payment methods, WhatsApp number and the delivery kill switch —
 * everything the cart drawer needs to render checkout. `deliveryEnabled` only
 * hides the option in the UI; `placeOrder` re-checks it server-side.
 */
export const getCheckoutOptionsAction = publicAction(
  { name: 'checkout.getOptions', rateLimit: { limit: 60, windowMs: 60_000 } },
  z.void(),
  async () => {
    const [communes, paymentMethods, settings] = await Promise.all([
      communeRepository.findAllActive(),
      paymentMethodRepository.findAllActive(),
      settingsRepository.get(),
    ]);
    return {
      communes,
      paymentMethods,
      whatsapp: settings.whatsapp,
      deliveryEnabled: settings.deliveryEnabled,
    };
  },
);

export const placeOrderAction = publicAction(
  { name: 'checkout.placeOrder', rateLimit: { limit: 8, windowMs: 60_000 } },
  checkoutSchema,
  async (input) => {
    const order = await placeOrder(input);

    revalidateTag('products');
    revalidateTag('orders');

    return { code: order.code, id: order.id, total: order.total };
  },
);

const previewTotalsSchema = cartSchema.extend({
  orderType: z.enum(['DELIVERY', 'PICKUP']),
  communeId: z.string().min(1).optional(),
});

/** Live totals for the cart drawer — same pricing engine used at checkout. */
export const previewCartTotalsAction = publicAction(
  { name: 'checkout.previewTotals', rateLimit: { limit: 120, windowMs: 60_000 } },
  previewTotalsSchema,
  async (input) => {
    const priced = await priceCart({
      items: input.items,
      couponCode: input.couponCode,
      orderType: input.orderType,
      communeId: input.orderType === 'DELIVERY' ? input.communeId : undefined,
    });

    return {
      subtotal: priced.subtotal,
      discount: priced.promotionDiscount + priced.couponDiscount,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
      items: priced.items.map((item) => ({
        cartItemId: item.cartItemId,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    };
  },
);
