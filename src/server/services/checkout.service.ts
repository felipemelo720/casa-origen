import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { priceCart, type CheckoutPricingInput } from '@/server/services/pricing.service';
import { getOpenState } from '@/server/services/schedule.service';
import { orderRepository } from '@/server/repositories/order.repository';
import { counterRepository } from '@/server/repositories/counter.repository';
import { customerRepository } from '@/server/repositories/customer.repository';
import { couponRepository } from '@/server/repositories/promotion.repository';
import { communeRepository, paymentMethodRepository } from '@/server/repositories/operations.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { sanitizeMultiline, sanitizePhone, sanitizeText, sanitizeEmail } from '@/lib/security/sanitize';
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
    throw new BusinessRuleError('El delivery no está disponible en este momento. Puedes retirar en tienda.');
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

  const pricingInput: CheckoutPricingInput = {
    items: input.cart.items,
    couponCode: input.cart.couponCode,
    orderType: input.orderType,
    communeId: input.orderType === 'DELIVERY' ? input.communeId : undefined,
  };

  const priced = await priceCart(pricingInput);

  if (paymentMethod.requiresChange && input.cashGiven !== undefined && input.cashGiven < priced.total) {
    throw new BusinessRuleError('El monto entregado es menor al total del pedido.');
  }

  const commune = input.orderType === 'DELIVERY' && input.communeId
    ? await communeRepository.findById(input.communeId)
    : null;

  const phone = sanitizePhone(input.phone);
  const firstName = sanitizeText(input.firstName, 60);
  const lastName = sanitizeText(input.lastName, 60);
  const email = input.email ? sanitizeEmail(input.email) : undefined;

  const order = await prisma.$transaction(async (tx) => {
    const sequence = await counterRepository.next('order-code', tx);
    const code = buildOrderCode(sequence);

    const customer = await customerRepository.upsertByPhone(phone, {
      firstName,
      lastName,
      phone,
      email,
    });

    const estimatedMinutes =
      input.orderType === 'DELIVERY'
        ? settings.deliveryEtaMinutes + (commune?.extraMinutes ?? 0)
        : settings.pickupEtaMinutes;

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
        cashGiven: paymentMethod.requiresChange ? input.cashGiven : undefined,
        changeDue: paymentMethod.requiresChange && input.cashGiven
          ? nonNegative(input.cashGiven - priced.total)
          : undefined,
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
      await couponRepository.incrementUsage(priced.couponId, tx);
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

  return order;
}
