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
