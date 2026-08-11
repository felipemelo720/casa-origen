/**
 * Bundle pricing ("2 pizzas de 32 cm por $17.990").
 *
 * Deliberately pure and free of `server-only`: `pricing.service` is still the
 * authority that decides what a customer is charged, but the cart drawer has
 * to show the same discount the moment the second pizza lands, or the total
 * jumps at checkout. Both call this, so there is one rule and one test suite
 * instead of a server copy and a client copy that drift.
 */

export type BundleRule = {
  promotionId: string;
  /** Shown on the cart's discount line, so it matches the card the customer tapped. */
  name: string;
  /** Price charged for one complete bundle. */
  bundlePrice: number;
  /** How many matching units make one bundle. */
  bundleSize: number;
  /** `VariantOption.name` every unit must carry ("32 cm"). */
  variantName: string;
  /** Empty means every product in the cart qualifies. */
  eligibleProductIds: readonly string[];
};

/** One single pizza — a line of quantity 2 contributes two of these. */
export type BundleUnit = {
  productId: string;
  /** What this unit costs on its own: base + variant deltas, extras excluded. */
  unitPrice: number;
  variantNames: readonly string[];
};

export function isBundleEligible(unit: BundleUnit, rule: BundleRule): boolean {
  if (rule.eligibleProductIds.length > 0 && !rule.eligibleProductIds.includes(unit.productId)) {
    return false;
  }
  return unit.variantNames.includes(rule.variantName);
}

/**
 * Discount the rule grants over a cart, in minor units.
 *
 * Complete bundles only, taken from the most expensive units down: a customer
 * who adds three qualifying pizzas gets the promo on the two dearest, which is
 * the pair the builder promised them. Extras never enter the bundle price —
 * they are charged on top, so adding tocino cannot be a way to get it free.
 */
export function bundleDiscount(units: readonly BundleUnit[], rule: BundleRule): number {
  if (rule.bundleSize < 1 || rule.bundlePrice < 0) return 0;

  const prices = units
    .filter((unit) => isBundleEligible(unit, rule))
    .map((unit) => unit.unitPrice)
    .sort((a, b) => b - a);

  const bundles = Math.floor(prices.length / rule.bundleSize);
  let discount = 0;

  for (let index = 0; index < bundles; index += 1) {
    const start = index * rule.bundleSize;
    const regular = prices
      .slice(start, start + rule.bundleSize)
      .reduce((sum, price) => sum + price, 0);
    // A bundle that costs more than the pizzas it contains is a misconfigured
    // promotion, not a surcharge: it grants nothing rather than adding to the
    // total.
    if (regular > rule.bundlePrice) discount += regular - rule.bundlePrice;
  }

  return discount;
}

/** How many more qualifying units the cart needs to complete the next bundle. */
export function unitsToNextBundle(units: readonly BundleUnit[], rule: BundleRule): number {
  if (rule.bundleSize < 1) return 0;
  const eligible = units.filter((unit) => isBundleEligible(unit, rule)).length;
  const remainder = eligible % rule.bundleSize;
  return remainder === 0 ? 0 : rule.bundleSize - remainder;
}
