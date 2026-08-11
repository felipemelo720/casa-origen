/**
 * What one add-on costs.
 *
 * The carta prices toppings on two axes at once — the pizza size and the tier
 * the topping belongs to:
 *
 * |           | 24 cm  | 32 cm  |
 * | Vegetales |  $700  | $1.200 |
 * | Premium   | $1.000 | $1.500 |
 *
 * So neither side owns the number: the tier is a flag on the add-on and the
 * two prices hang off the selected size. Pure and free of `server-only`
 * because `pricing.service` decides what is charged while the product card and
 * the cart have to print the same figure — one rule, one place.
 */

/** The add-on prices a size option carries. */
export type SizeExtraPricing = {
  extraPrice: number | null;
  extraPremiumPrice: number | null;
};

/**
 * Price the selected size charges for an add-on of this tier, or `null` when
 * the size does not price add-ons at all and the caller should fall back to the
 * add-on's own catalogue price.
 *
 * A size with no `extraPremiumPrice` charges `extraPrice` for everything: that
 * is a size that does not split by tier, not a free premium topping.
 */
export function sizeExtraPrice(
  size: SizeExtraPricing | null | undefined,
  isPremium: boolean,
): number | null {
  if (!size) return null;
  if (isPremium) return size.extraPremiumPrice ?? size.extraPrice;
  return size.extraPrice;
}

/**
 * Final unit price of an add-on: the size wins whenever it prices add-ons, then
 * the per-product override, then the add-on's own catalogue price.
 */
export function resolveExtraPrice(input: {
  size: SizeExtraPricing | null | undefined;
  isPremium: boolean;
  priceOverride?: number | null;
  catalogPrice: number;
}): number {
  return sizeExtraPrice(input.size, input.isPremium) ?? input.priceOverride ?? input.catalogPrice;
}
