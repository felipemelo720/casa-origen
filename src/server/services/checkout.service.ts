import 'server-only';

import { priceCart, type CheckoutPricingInput } from '@/server/services/pricing.service';
import { getOpenState } from '@/server/services/schedule.service';
import { getCurrentCustomer } from '@/server/services/customer-auth.service';
import { orderRepository } from '@/server/repositories/order.repository';
import { counterRepository } from '@/server/repositories/counter.repository';
import { customerRepository } from '@/server/repositories/customer.repository';
import { couponRepository } from '@/server/repositories/promotion.repository';
import {
  communeRepository,
  paymentMethodRepository,
} from '@/server/repositories/operations.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { withTransaction } from '@/server/repositories/transaction.repository';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import {
  sanitizeMultiline,
  sanitizePhone,
  sanitizeText,
  sanitizeEmail,
} from '@/lib/security/sanitize';
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp-order-message';
import { nonNegative } from '@/lib/money';
import type { CheckoutInput } from '@/schemas/checkout.schema';

function buildOrderCode(sequence: number): string {
  const date = new Date();
  const stamp = `${date.getFullYear().toString().slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `CO-${stamp}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Places an order end to end inside a single transaction.
 *
 * Every write that must be atomic with order creation — the sequential code,
 * the coupon redemption, the customer's running totals, the product
 * "most sold" counter — happens on the same `tx` handle, so a failure at any
 * step rolls back the entire order instead of leaving partial state.
 */
export async function placeOrder(input: CheckoutInput) {
  const open = await getOpenState();
  if (!open.isOpen) {
    throw new BusinessRuleError(open.reason ?? 'No estamos aceptando pedidos en este momento.');
  }

  const settings = await settingsRepository.get();

  if (input.orderType === 'DELIVERY' && !settings.deliveryEnabled) {
    throw new BusinessRuleError(
      'El delivery no está disponible en este momento. Puedes retirar en tienda.',
    );
  }

  const paymentMethod = await paymentMethodRepository.findById(input.paymentMethodId);
  if (!paymentMethod || !paymentMethod.isActive) {
    throw new NotFoundError('El método de pago');
  }

  if (paymentMethod.requiresChange) {
    if (input.cashGiven === undefined) {
      throw new BusinessRuleError('Indica con cuánto efectivo pagarás.');
    }
  }

  // A signed-in customer owns the order regardless of the phone typed into the
  // form, so editing that field cannot move the purchase onto someone else's
  // history. Guests keep the phone-keyed upsert.
  //
  // Resolved *before* pricing, not after: `perCustomerLimit` is enforced inside
  // `priceCart`, and without an id here that check never ran for anyone.
  const session = await getCurrentCustomer();

  const pricingInput: CheckoutPricingInput = {
    items: input.cart.items,
    couponCode: input.cart.couponCode,
    orderType: input.orderType,
    communeId: input.orderType === 'DELIVERY' ? input.communeId : undefined,
    customerId: session?.id,
  };

  const priced = await priceCart(pricingInput);

  if (
    paymentMethod.requiresChange &&
    input.cashGiven !== undefined &&
    input.cashGiven < priced.total
  ) {
    throw new BusinessRuleError('El monto entregado es menor al total del pedido.');
  }

  const commune =
    input.orderType === 'DELIVERY' && input.communeId
      ? await communeRepository.findById(input.communeId)
      : null;

  const phone = sanitizePhone(input.phone);
  const firstName = sanitizeText(input.firstName, 60);
  const lastName = sanitizeText(input.lastName, 60);
  const email = input.email ? sanitizeEmail(input.email) : undefined;

  const estimatedMinutes =
    input.orderType === 'DELIVERY'
      ? settings.deliveryEtaMinutes + (commune?.extraMinutes ?? 0)
      : settings.pickupEtaMinutes;

  const cashGiven = paymentMethod.requiresChange ? input.cashGiven : undefined;
  const changeDue = cashGiven !== undefined ? nonNegative(cashGiven - priced.total) : undefined;

  const order = await withTransaction(async (tx) => {
    const sequence = await counterRepository.next('order-code', tx);
    const code = buildOrderCode(sequence);

    const customer =
      session ??
      (await customerRepository.upsertByPhone(phone, {
        firstName,
        lastName,
        phone,
        email,
      }));

    const created = await orderRepository.create(
      {
        code,
        status: 'NEW',
        type: input.orderType,
        paymentStatus: paymentMethod.code === 'CASH' ? 'PENDING' : 'PENDING',
        customer: { connect: { id: customer.id } },
        firstName,
        lastName,
        phone,
        email,
        street: input.orderType === 'DELIVERY' ? sanitizeText(input.street ?? '', 160) : undefined,
        reference: input.reference ? sanitizeText(input.reference, 160) : undefined,
        commune: commune ? { connect: { id: commune.id } } : undefined,
        communeName: commune?.name,
        subtotal: priced.subtotal,
        discountTotal: priced.promotionDiscount + priced.couponDiscount,
        deliveryFee: priced.deliveryFee,
        total: priced.total,
        cashGiven,
        changeDue,
        paymentMethod: { connect: { id: paymentMethod.id } },
        coupon: priced.couponId ? { connect: { id: priced.couponId } } : undefined,
        promotion: priced.promotionId ? { connect: { id: priced.promotionId } } : undefined,
        notes: input.notes ? sanitizeMultiline(input.notes, 300) : undefined,
        estimatedMinutes,
        items: {
          create: priced.items.map((item) => ({
            product: { connect: { id: item.productId } },
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            notes: item.notes ? sanitizeText(item.notes, 300) : undefined,
            removedIngredients: item.removedIngredientNames,
            variants: {
              create: item.variants.map((variant) => ({
                option: { connect: { id: variant.optionId } },
                groupName: variant.groupName,
                optionName: variant.optionName,
                priceDelta: variant.priceDelta,
              })),
            },
            extras: {
              create: item.extras.map((extra) => ({
                extra: { connect: { id: extra.extraId } },
                name: extra.name,
                unitPrice: extra.unitPrice,
                quantity: extra.quantity,
              })),
            },
          })),
        },
      },
      tx,
    );

    await orderRepository.appendHistory(
      {
        order: { connect: { id: created.id } },
        toStatus: 'NEW',
        note: 'Pedido creado por el cliente.',
      },
      tx,
    );

    for (const item of priced.items) {
      await orderRepository.incrementProductSoldCount(item.productId, item.quantity, tx);
    }

    await customerRepository.recordOrder(customer.id, priced.total, tx);

    if (priced.couponId) {
      // Fail closed: between the quote and this write another order can have
      // taken the last redemption. Throwing rolls the whole order back rather
      // than handing out a discount the coupon no longer had.
      const consumed = await couponRepository.consumeUsage(priced.couponId, tx);
      if (!consumed) {
        throw new BusinessRuleError('El cupón se agotó mientras confirmabas el pedido.');
      }
      await couponRepository.createRedemption(
        {
          coupon: { connect: { id: priced.couponId } },
          order: { connect: { id: created.id } },
          customerId: customer.id,
          discountAmount: priced.couponDiscount,
        },
        tx,
      );
    }

    return created;
  });

  // Built here, from the priced order, so the operator reads exactly what the
  // row says. The browser only opens the link — it never composes the message.
  const whatsappUrl = buildWhatsAppOrderUrl(settings.whatsapp, {
    code: order.code,
    firstName,
    lastName,
    phone,
    orderType: input.orderType,
    street: input.orderType === 'DELIVERY' ? input.street : undefined,
    reference: input.reference,
    communeName: commune?.name,
    paymentMethodName: paymentMethod.name,
    cashGiven,
    changeDue,
    notes: input.notes,
    subtotal: priced.subtotal,
    discount: priced.promotionDiscount + priced.couponDiscount,
    deliveryFee: priced.deliveryFee,
    deliveryFeeMax: priced.deliveryFeeMax,
    total: priced.total,
    estimatedMinutes,
    items: priced.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      variants: item.variants.map((variant) => ({ optionName: variant.optionName })),
      extras: item.extras.map((extra) => ({ name: extra.name, quantity: extra.quantity })),
      removedIngredientNames: item.removedIngredientNames,
      notes: item.notes,
    })),
  });

  return { order, whatsappUrl };
}
