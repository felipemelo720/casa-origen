'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';

import { publicAction } from '@/server/actions/action-builder';
import { checkoutSchema } from '@/schemas/checkout.schema';
import { cartSchema } from '@/schemas/cart.schema';
import { placeOrder } from '@/server/services/checkout.service';
import { priceCart } from '@/server/services/pricing.service';

// `getCheckoutOptionsAction` used to live here. Communes, payment methods and
// the delivery kill switch are already loaded by the storefront layout, so the
// drawer gets them as props (`buildCheckoutOptions`) instead of paying a
// round trip the moment the checkout step opens.

export const placeOrderAction = publicAction(
  { name: 'checkout.placeOrder', rateLimit: { limit: 8, windowMs: 60_000 } },
  checkoutSchema,
  async (input) => {
    const { order, whatsappUrl } = await placeOrder(input);

    revalidateTag('products');
    revalidateTag('orders');

    return { code: order.code, id: order.id, total: order.total, whatsappUrl };
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
      // The band travels with the charge so the totals block can say the fee is
      // an estimate. Without it the checkout would print one exact figure for
      // something the operator still has to confirm.
      deliveryFeeMin: priced.deliveryFeeMin,
      deliveryFeeMax: priced.deliveryFeeMax,
      total: priced.total,
      items: priced.items.map((item) => ({
        cartItemId: item.cartItemId,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    };
  },
);
