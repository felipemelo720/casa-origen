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
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

export const productRepository = {
  /** Full menu for the single-page storefront: active + visible, with variants for inline size selection. */
  async findAllForMenu(): Promise<ProductDetail[]> {
    return prisma.product.findMany({
      where: { isActive: true, isVisible: true },
      include: productDetailInclude,
      orderBy: { sortOrder: 'asc' },
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
              select: { id: true, name: true, priceDelta: true, isAvailable: true },
            },
          },
        },
        extras: {
          select: {
            extraId: true,
            priceOverride: true,
            maxQuantity: true,
            extra: { select: { id: true, name: true, price: true, isActive: true } },
          },
        },
      },
    });
  },

  /** Every active product with its category name, for the admin availability toggle list. */
  async findAllForAvailabilityToggle() {
    return prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        availability: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  },

  async setAvailability(id: string, availability: Prisma.ProductUpdateInput['availability']) {
    return prisma.product.update({ where: { id }, data: { availability } });
  },
};
