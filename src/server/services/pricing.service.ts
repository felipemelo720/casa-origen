import 'server-only';

import { productRepository } from '@/server/repositories/product.repository';
import { promotionRepository, couponRepository } from '@/server/repositories/promotion.repository';
import { communeRepository, settingsRepository } from '@/server/repositories/operations.repository';
import { nonNegative, percentageOf, sumMoney } from '@/lib/money';
import { bundleDiscount, type BundleUnit } from '@/lib/bundle-promo';
import { resolveExtraPrice, type SizeExtraPricing } from '@/lib/extra-price';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import type { CartItemInput } from '@/schemas/cart.schema';

export type PricedExtra = {
  extraId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type PricedVariant = {
  optionId: string;
  groupName: string;
  optionName: string;
  priceDelta: number;
};

export type PricedItem = {
  cartItemId: string;
  productId: string;
  categoryId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  removedIngredientNames: string[];
  variants: PricedVariant[];
  extras: PricedExtra[];
};

export type PricedCart = {
  items: PricedItem[];
  subtotal: number;
  promotionDiscount: number;
  promotionId: string | null;
  couponDiscount: number;
  couponId: string | null;
  deliveryFee: number;
  /**
   * The band the zone is advertised at. `deliveryFee` is what the total
   * charges — always the low end — while this is what the storefront prints so
   * the customer is not surprised when the operator confirms the real amount.
   * Both ends collapse to `deliveryFee` whenever the fee stops being an
   * estimate: pickup, a waived fee, a free-delivery coupon, a flat zone.
   */
  deliveryFeeMin: number;
  deliveryFeeMax: number;
  total: number;
};

/**
 * Recomputes every line of a cart purely from the catalogue, ignoring any
 * price the client may have sent. This is the single choke point that
 * guarantees an order is never charged at a tampered amount.
 */
async function priceItem(input: CartItemInput): Promise<PricedItem> {
  const product = await productRepository.findForPricing(input.productId);
  if (!product || !product.isActive) {
    throw new NotFoundError(`El producto solicitado`);
  }
  if (product.availability !== 'AVAILABLE') {
    throw new BusinessRuleError(`"${product.name}" no está disponible en este momento.`);
  }

  const basePrice = product.offerPrice ?? product.price;

  const variantsByOption = new Map(
    product.variantGroups.flatMap((group) =>
      group.options.map((option) => [option.id, { group, option }] as const),
    ),
  );

  const selectedVariants: PricedVariant[] = [];
  for (const optionId of input.selectedVariantOptionIds) {
    const match = variantsByOption.get(optionId);
    if (!match || !match.option.isAvailable) {
      throw new BusinessRuleError(`Una de las opciones seleccionadas ya no está disponible.`);
    }
    selectedVariants.push({
      optionId: match.option.id,
      groupName: match.group.name,
      optionName: match.option.name,
      priceDelta: match.option.priceDelta,
    });
  }

  // Every required group must have a selection within its min/max bounds.
  for (const group of product.variantGroups) {
    if (!group.isRequired) continue;
    const selectedCount = selectedVariants.filter((v) =>
      group.options.some((o) => o.id === v.optionId),
    ).length;
    if (selectedCount < group.minSelect || selectedCount > group.maxSelect) {
      throw new BusinessRuleError(`Completa la selección de "${group.name}".`);
    }
  }

  // The carta charges add-ons by pizza size *and* by tier, so the size that is
  // selected wins over the add-on's own catalogue price whenever it prices
  // add-ons at all. Only the option is resolved here; the amount depends on
  // which add-on is being priced.
  const selectedSize = selectedVariants.reduce<SizeExtraPricing | null>((size, variant) => {
    const option = variantsByOption.get(variant.optionId)?.option;
    return option?.extraPrice != null
      ? { extraPrice: option.extraPrice, extraPremiumPrice: option.extraPremiumPrice }
      : size;
  }, null);

  const extrasByProduct = new Map(product.extras.map((entry) => [entry.extraId, entry]));
  const selectedExtras: PricedExtra[] = [];
  for (const requested of input.selectedExtras) {
    const entry = extrasByProduct.get(requested.extraId);
    if (!entry || !entry.extra.isActive) {
      throw new BusinessRuleError(`Uno de los extras seleccionados ya no está disponible.`);
    }
    const quantity = Math.min(requested.quantity, entry.maxQuantity);
    selectedExtras.push({
      extraId: entry.extra.id,
      name: entry.extra.name,
      unitPrice: resolveExtraPrice({
        size: selectedSize,
        isPremium: entry.extra.isPremium,
        priceOverride: entry.priceOverride,
        catalogPrice: entry.extra.price,
      }),
      quantity,
    });
  }

  const variantsTotal = sumMoney(selectedVariants.map((v) => v.priceDelta));
  const extrasTotal = sumMoney(selectedExtras.map((e) => e.unitPrice * e.quantity));
  const unitPrice = nonNegative(basePrice + variantsTotal);
  const lineTotal = nonNegative(unitPrice * input.quantity + extrasTotal * input.quantity);

  return {
    cartItemId: input.cartItemId,
    productId: product.id,
    categoryId: product.categoryId,
    name: product.name,
    quantity: input.quantity,
    unitPrice,
    lineTotal,
    notes: input.notes,
    removedIngredientNames: input.removedIngredientIds,
    variants: selectedVariants,
    extras: selectedExtras,
  };
}

export type CheckoutPricingInput = {
  items: CartItemInput[];
  couponCode?: string;
  orderType: 'DELIVERY' | 'PICKUP';
  communeId?: string;
  customerId?: string;
};

export async function priceCart(input: CheckoutPricingInput): Promise<PricedCart> {
  const items = await Promise.all(input.items.map(priceItem));
  const subtotal = sumMoney(items.map((item) => item.lineTotal));

  const settings = await settingsRepository.get();
  if (subtotal < settings.minOrderAmount) {
    throw new BusinessRuleError(`El pedido mínimo es de ${settings.minOrderAmount}.`);
  }

  // --- Best applicable promotion (highest priority, first match wins) -----
  const activePromotions = await promotionRepository.findActive();
  const productIds = new Set(items.map((item) => item.productId));
  const categoryIds = new Set(items.map((item) => item.categoryId));

  let promotionDiscount = 0;
  let promotionId: string | null = null;

  // One entry per single pizza — a line of quantity 2 counts twice — so a
  // bundle rule can pair units across lines and inside a single line alike.
  const bundleUnits: BundleUnit[] = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      productId: item.productId,
      unitPrice: item.unitPrice,
      variantNames: item.variants.map((variant) => variant.optionName),
    })),
  );

  for (const promo of activePromotions) {
    if (subtotal < promo.minSubtotal) continue;

    const applies =
      promo.scope === 'ALL' ||
      (promo.scope === 'PRODUCT' && promo.products.some((p) => productIds.has(p.productId))) ||
      (promo.scope === 'CATEGORY' && promo.categories.some((c) => categoryIds.has(c.categoryId)));

    if (!applies) continue;

    let raw: number;
    if (promo.discountType === 'BUNDLE_PRICE') {
      raw = bundleDiscount(bundleUnits, {
        promotionId: promo.id,
        name: promo.name,
        bundlePrice: promo.value,
        bundleSize: promo.bundleSize,
        variantName: promo.bundleVariantName ?? '',
        eligibleProductIds:
          promo.scope === 'PRODUCT' ? promo.products.map((entry) => entry.productId) : [],
      });
      // An incomplete bundle grants nothing. Unlike the other kinds it must not
      // win the loop either, or a cart with one lonely 32 cm would swallow the
      // promotion slot and block every lower-priority discount behind it.
      if (raw <= 0) continue;
    } else {
      raw = promo.discountType === 'PERCENTAGE' ? percentageOf(subtotal, promo.value) : promo.value;
    }

    const capped = promo.maxDiscount ? Math.min(raw, promo.maxDiscount) : raw;

    promotionDiscount = nonNegative(capped);
    promotionId = promo.id;
    break;
  }

  // --- Delivery fee ---------------------------------------------------
  let deliveryFee = 0;
  // Tracked separately from `deliveryFee` so that zeroing the charge (free
  // delivery, coupon) also collapses the advertised band. A cart that charges
  // nothing while still showing "$3.500 – $7.000" reads as a bug.
  let deliveryFeeMax = 0;
  if (input.orderType === 'DELIVERY') {
    if (!input.communeId) throw new BusinessRuleError('Selecciona tu comuna de despacho.');
    const commune = await communeRepository.findById(input.communeId);
    if (!commune || !commune.isActive)
      throw new BusinessRuleError('La comuna seleccionada no está disponible.');
    if (subtotal < commune.minOrder) {
      throw new BusinessRuleError(
        `El pedido mínimo para ${commune.name} es de ${commune.minOrder}.`,
      );
    }
    deliveryFee = commune.deliveryFee || settings.defaultDeliveryFee;
    // Never below what is being charged: a zone left without a top end would
    // otherwise advertise a band that ends under its own floor.
    deliveryFeeMax = Math.max(commune.deliveryFeeMax, deliveryFee);
    if (settings.freeDeliveryFrom > 0 && subtotal >= settings.freeDeliveryFrom) {
      deliveryFee = 0;
      deliveryFeeMax = 0;
    }
  }

  // --- Coupon -----------------------------------------------------------
  let couponDiscount = 0;
  let couponId: string | null = null;

  if (input.couponCode) {
    const coupon = await couponRepository.findByCode(input.couponCode);
    const now = new Date();

    if (
      !coupon ||
      !coupon.isActive ||
      coupon.startsAt > now ||
      (coupon.endsAt && coupon.endsAt < now) ||
      subtotal < coupon.minSubtotal ||
      (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)
    ) {
      throw new BusinessRuleError('El cupón no es válido o ha expirado.');
    }

    if (input.customerId) {
      const used = await couponRepository.countCustomerRedemptions(coupon.id, input.customerId);
      if (used >= coupon.perCustomerLimit) {
        throw new BusinessRuleError('Ya has usado este cupón el máximo de veces permitido.');
      }
    }

    const raw =
      coupon.discountType === 'PERCENTAGE' ? percentageOf(subtotal, coupon.value) : coupon.value;
    couponDiscount = nonNegative(coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw);
    couponId = coupon.id;

    if (coupon.freeDelivery) {
      deliveryFee = 0;
      deliveryFeeMax = 0;
    }
  }

  const discount = Math.max(promotionDiscount, couponDiscount);
  const usingPromotion = promotionDiscount >= couponDiscount;

  const total = nonNegative(subtotal - discount + deliveryFee);

  return {
    items,
    subtotal,
    promotionDiscount: usingPromotion ? discount : 0,
    promotionId: usingPromotion ? promotionId : null,
    couponDiscount: !usingPromotion ? discount : 0,
    couponId: !usingPromotion ? couponId : null,
    deliveryFee,
    deliveryFeeMin: deliveryFee,
    deliveryFeeMax,
    total,
  };
}
