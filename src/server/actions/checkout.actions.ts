'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidateTag } from 'next/cache';

import { publicAction } from '@/server/actions/action-builder';
import { checkoutSchema } from '@/schemas/checkout.schema';
import { cartSchema } from '@/schemas/cart.schema';
import { placeOrder } from '@/server/services/checkout.service';
import { priceCart } from '@/server/services/pricing.service';
import { getClientIp } from '@/lib/security/rate-limit';
import { communeRepository, paymentMethodRepository } from '@/server/repositories/operations.repository';

/** Communes + payment methods needed to render the checkout step inside the cart drawer. */
export const getCheckoutOptionsAction = publicAction(
  { name: 'checkout.getOptions', rateLimit: { limit: 60, windowMs: 60_000 } },
  z.void(),
  async () => {
    const [communes, paymentMethods] = await Promise.all([
      communeRepository.findAllActive(),
      paymentMethodRepository.findAllActive(),
    ]);
    return { communes, paymentMethods };
  },
);

export const placeOrderAction = publicAction(
  { name: 'checkout.placeOrder', rateLimit: { limit: 8, windowMs: 60_000 } },
  checkoutSchema,
  async (input, { user }) => {
    const headerList = await headers();
    const order = await placeOrder(input, {
      userId: user?.id,
      ipAddress: await getClientIp(),
      userAgent: headerList.get('user-agent') ?? undefined,
    });

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
