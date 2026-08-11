import type { BundleRule } from '@/lib/bundle-promo';
import type { ProductDetail } from '@/server/repositories/product.repository';

/** One pizza the builder offers, already resolved at the bundle's size. */
export type DuoPromoOption = {
  productId: string;
  name: string;
  shortDescription: string | null;
  image: string | null;
  groupId: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
  extraPrice: number | null;
  extraPremiumPrice: number | null;
  basePrice: number;
  /** What this pizza costs on its own at the bundle's size. */
  unitPrice: number;
  available: boolean;
};

/** Add-on sold from the builder footer once the bundle is complete. */
export type DuoPromoDrink = {
  productId: string;
  name: string;
  image: string | null;
  price: number;
};

export type DuoPromoView = {
  promotionId: string;
  name: string;
  description: string | null;
  image: string | null;
  /** Price of one complete bundle. */
  bundlePrice: number;
  bundleSize: number;
  /** Copy for the size the bundle is sold at ("32 cm"). */
  sizeLabel: string;
  /** `VariantOption.name` the pricing engine matches on. */
  variantName: string;
  /** Cheapest complete bundle at list price — the anchor before anything is picked. */
  regularFrom: number;
  options: DuoPromoOption[];
  drinks: DuoPromoDrink[];
};

type FeaturedBundle = {
  id: string;
  name: string;
  description: string | null;
  value: number;
  scope: 'ALL' | 'CATEGORY' | 'PRODUCT';
  bundleSize: number;
  bundleVariantName: string | null;
  bundleSizeLabel: string | null;
  image: string | null;
  products: { productId: string }[];
};

const DRINKS_CATEGORY_SLUG = 'bebidas';
const DRINKS_IN_BUILDER = 3;

/**
 * The same promotion, shaped for the cart drawer.
 *
 * The drawer needs it because the cart total it prints is computed in the
 * browser: without the rule the second pizza would show at list price and the
 * total would drop only at checkout, which reads as a pricing bug even though
 * it is a discount. `pricing.service` still decides what is charged.
 */
export function toBundleRule(promo: FeaturedBundle | null): BundleRule | null {
  if (!promo || !promo.bundleVariantName || promo.bundleSize < 2) return null;
  return {
    promotionId: promo.id,
    name: promo.name,
    bundlePrice: promo.value,
    bundleSize: promo.bundleSize,
    variantName: promo.bundleVariantName,
    eligibleProductIds:
      promo.scope === 'PRODUCT' ? promo.products.map((entry) => entry.productId) : [],
  };
}

/**
 * Turns the featured bundle promotion into what the landing renders.
 *
 * Takes the products the home already fetched instead of querying again: the
 * builder offers a subset of the same menu, so a second round trip would only
 * buy a chance for the two lists to disagree.
 *
 * Returns `null` whenever the promotion cannot actually be built — no bundle
 * configured, or fewer distinct pizzas on offer than the bundle needs — so the
 * landing never paints a card that opens onto an empty picker.
 */
export function buildDuoPromoView(
  promo: FeaturedBundle | null,
  products: ProductDetail[],
): DuoPromoView | null {
  if (!promo) return null;

  const variantName = promo.bundleVariantName;
  if (!variantName || promo.bundleSize < 2) return null;

  const eligibleIds =
    promo.scope === 'PRODUCT' ? new Set(promo.products.map((p) => p.productId)) : null;

  const options: DuoPromoOption[] = [];
  for (const product of products) {
    if (eligibleIds && !eligibleIds.has(product.id)) continue;

    const group = product.variantGroups.find((candidate) =>
      candidate.options.some((option) => option.name === variantName),
    );
    const option = group?.options.find((candidate) => candidate.name === variantName);
    if (!group || !option) continue;

    const basePrice = product.offerPrice ?? product.price;
    options.push({
      productId: product.id,
      name: product.name,
      shortDescription: product.shortDescription,
      image: product.image,
      groupId: group.id,
      optionId: option.id,
      optionName: option.name,
      priceDelta: option.priceDelta,
      extraPrice: option.extraPrice,
      extraPremiumPrice: option.extraPremiumPrice,
      basePrice,
      unitPrice: basePrice + option.priceDelta,
      available: product.availability === 'AVAILABLE' && option.isAvailable,
    });
  }

  // The same pizza can fill every slot, so one available option is enough to
  // complete a bundle — but zero is a picker with nothing to pick.
  if (!options.some((option) => option.available)) return null;

  const cheapest = Math.min(...options.filter((o) => o.available).map((o) => o.unitPrice));

  const drinks = products
    .filter(
      (product) =>
        product.category.slug === DRINKS_CATEGORY_SLUG && product.availability === 'AVAILABLE',
    )
    .slice(0, DRINKS_IN_BUILDER)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.offerPrice ?? product.price,
    }));

  return {
    promotionId: promo.id,
    name: promo.name,
    description: promo.description,
    image: promo.image,
    bundlePrice: promo.value,
    bundleSize: promo.bundleSize,
    sizeLabel: promo.bundleSizeLabel ?? variantName,
    variantName,
    regularFrom: cheapest * promo.bundleSize,
    options,
    drinks,
  };
}
