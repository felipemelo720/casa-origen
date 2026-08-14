import type { ProductDetail } from '@/server/repositories/product.repository';

/** One choice inside a group ("Napolitana", "Coca-Cola"). */
export type ComboPromoChoice = {
  optionId: string;
  name: string;
  priceDelta: number;
  /**
   * Borrowed from the catalogue product of the same name. The options are
   * `VariantOption` rows and carry no image of their own, so without this the
   * picker would be a list of words where the dúo builder shows pizzas.
   */
  image: string | null;
  shortDescription: string | null;
  /**
   * Add-on prices this choice implies, carried into the cart line so the drawer
   * can quote a tocino without another round trip. Only the flavour group sets
   * them — a drink prices no toppings — and the drawer prefers the live
   * catalogue over this snapshot anyway.
   */
  extraPrice: number | null;
  extraPremiumPrice: number | null;
  available: boolean;
};

/** One required decision the customer makes ("Elige tu pizza"). */
export type ComboPromoGroup = {
  groupId: string;
  name: string;
  choices: ComboPromoChoice[];
};

export type ComboPromoView = {
  productId: string;
  name: string;
  description: string | null;
  image: string | null;
  /** What the combo is actually charged at — `offerPrice` when there is one. */
  price: number;
  /** List price of the same thing bought loose. Equals `price` when there is no offer. */
  regularPrice: number;
  groups: ComboPromoGroup[];
};

/**
 * Turns the hidden combo product into what the landing's promo card renders.
 *
 * Takes the menu the home already fetched instead of querying again: the
 * choices are named after catalogue products, and a second round trip would
 * only buy a chance for the two lists to disagree about a photo or about
 * whether a pizza is sold out.
 *
 * Returns `null` whenever the combo cannot actually be built — missing product,
 * no groups, or a group whose every choice is unavailable — so the landing never
 * paints a card that opens onto a picker with nothing to pick.
 */
export function buildComboPromoView(
  combo: ProductDetail | null,
  menu: ProductDetail[],
): ComboPromoView | null {
  if (!combo) return null;
  if (combo.availability !== 'AVAILABLE') return null;
  if (combo.variantGroups.length === 0) return null;

  // Matched by name because that is what the seed writes into the options:
  // an id would tie the combo to one specific row and break the moment the
  // catalogue product is reseeded.
  const byName = new Map(menu.map((product) => [product.name, product]));

  const groups: ComboPromoGroup[] = combo.variantGroups.map((group) => ({
    groupId: group.id,
    name: group.name,
    choices: group.options.map((option) => {
      const source = byName.get(option.name);
      return {
        optionId: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
        image: source?.image ?? null,
        shortDescription: source?.shortDescription ?? null,
        extraPrice: option.extraPrice,
        extraPremiumPrice: option.extraPremiumPrice,
        // Sold out upstream means sold out here: the combo cannot hand out a
        // pizza the kitchen has switched off, even though the option row
        // itself knows nothing about it.
        available: option.isAvailable && (source ? source.availability === 'AVAILABLE' : true),
      };
    }),
  }));

  // Every group is a required decision, so one group with nothing available
  // makes the whole combo unbuildable.
  if (groups.some((group) => !group.choices.some((choice) => choice.available))) return null;

  return {
    productId: combo.id,
    name: combo.name,
    description: combo.description,
    image: combo.image,
    price: combo.offerPrice ?? combo.price,
    regularPrice: combo.price,
    groups,
  };
}

/**
 * What the combo costs with these exact choices.
 *
 * Mirrors `pricing.service` (`offerPrice ?? price` plus the picked deltas) so
 * the sheet's footer shows the number the server will charge. The server stays
 * the authority — this only exists so the total does not jump at checkout.
 */
export function comboTotal(view: ComboPromoView, picked: readonly ComboPromoChoice[]): number {
  return picked.reduce((sum, choice) => sum + choice.priceDelta, view.price);
}
