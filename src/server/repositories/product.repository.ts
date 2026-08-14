import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

/** Shared include used everywhere the storefront needs a fully hydrated product. */
export const productDetailInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  tags: { include: { tag: true } },
  ingredients: { include: { ingredient: true } },
  variantGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: { options: { orderBy: { sortOrder: 'asc' as const } } },
  },
  extras: {
    orderBy: { sortOrder: 'asc' as const },
    include: { extra: true },
  },
  // `sortOrder` rides along so the menu can group the grid by category and keep
  // the categories in the order the carta lists them.
  category: { select: { id: true, name: true, slug: true, sortOrder: true } },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

/** How many products the landing strip shows. The admin list warns past this. */
export const HIGHLIGHTED_LIMIT = 4;

/**
 * The combo the landing advertises in its own card. Pinned by slug because the
 * card is a fixed piece of the page, not a curated list: there is exactly one.
 */
export const COMBO_PROMO_SLUG = 'combo-individual';

export const productRepository = {
  /** Full menu for the single-page storefront: active + visible, with variants for inline size selection. */
  async findAllForMenu(): Promise<ProductDetail[]> {
    return prisma.product.findMany({
      where: { isActive: true, isVisible: true },
      include: productDetailInclude,
      orderBy: { sortOrder: 'asc' },
    });
  },

  /**
   * Best sellers for the landing strip, ranked by the running `soldCount` that
   * `incrementProductSoldCount` maintains. Products nobody has ordered yet are
   * excluded so a fresh install shows nothing instead of an arbitrary list.
   */
  async findTopSellers(limit: number): Promise<ProductDetail[]> {
    return prisma.product.findMany({
      where: { isActive: true, isVisible: true, soldCount: { gt: 0 } },
      include: productDetailInclude,
      orderBy: [{ soldCount: 'desc' }, { sortOrder: 'asc' }],
      take: limit,
    });
  },

  /**
   * What the landing strip actually renders. The admin picks the products by
   * hand (`isFeatured`); with nothing picked it falls back to the `soldCount`
   * ranking, so the section keeps working on its own if nobody curates it.
   */
  async findHighlighted(limit: number): Promise<ProductDetail[]> {
    const featured = await prisma.product.findMany({
      where: { isActive: true, isVisible: true, isFeatured: true },
      include: productDetailInclude,
      orderBy: { sortOrder: 'asc' },
      take: limit,
    });
    if (featured.length > 0) return featured;
    return productRepository.findTopSellers(limit);
  },

  /**
   * The combo behind the landing's promo card.
   *
   * Deliberately does **not** filter on `isVisible`: the combo is kept out of
   * the carta grid on purpose (a price with no size next to the pizzas reads
   * like a cheaper pizza), and its card is the only place it is sold from.
   * `isActive` is still required — that is the flag that retires a product.
   */
  async findComboPromo(slug: string = COMBO_PROMO_SLUG): Promise<ProductDetail | null> {
    return prisma.product.findFirst({
      where: { slug, isActive: true },
      include: productDetailInclude,
    });
  },

  /**
   * Add-ons per product, for the cart drawer: the cart only stores the picked
   * ids, so adding one later needs the catalogue that the product card had.
   */
  async findAddOnsByProduct() {
    return prisma.productExtra.findMany({
      where: {
        extra: { isActive: true },
        product: { isActive: true, isVisible: true },
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        productId: true,
        priceOverride: true,
        extra: { select: { id: true, name: true, price: true, isPremium: true } },
      },
    });
  },

  /**
   * Add-on prices per size option, for the cart drawer.
   *
   * The cart persists a snapshot of these on every line, and a cart saved
   * before the carta changed keeps quoting the old figures forever. The drawer
   * prefers this map and falls back to the snapshot, so a stale localStorage
   * heals itself on the next render instead of lying until someone clears it.
   */
  async findSizeExtraPricing() {
    return prisma.variantOption.findMany({
      where: { extraPrice: { not: null } },
      select: { id: true, extraPrice: true, extraPremiumPrice: true },
    });
  },

  /** Minimal shape needed by the pricing engine — avoids over-fetching. */
  async findForPricing(id: string) {
    return prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
        offerPrice: true,
        isActive: true,
        availability: true,
        categoryId: true,
        variantGroups: {
          select: {
            id: true,
            name: true,
            isRequired: true,
            minSelect: true,
            maxSelect: true,
            options: {
              select: {
                id: true,
                name: true,
                priceDelta: true,
                extraPrice: true,
                extraPremiumPrice: true,
                isAvailable: true,
              },
            },
          },
        },
        extras: {
          select: {
            extraId: true,
            priceOverride: true,
            maxQuantity: true,
            extra: {
              select: { id: true, name: true, price: true, isActive: true, isPremium: true },
            },
          },
        },
      },
    });
  },

  /** Every active product with its category name, for the admin availability + featured toggles. */
  async findAllForAvailabilityToggle() {
    return prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        availability: true,
        isFeatured: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  },

  async setAvailability(id: string, availability: Prisma.ProductUpdateInput['availability']) {
    return prisma.product.update({ where: { id }, data: { availability } });
  },

  async setFeatured(id: string, isFeatured: boolean) {
    return prisma.product.update({ where: { id }, data: { isFeatured } });
  },
};
