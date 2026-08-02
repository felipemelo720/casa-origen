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

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  image: true,
  price: true,
  offerPrice: true,
  isFeatured: true,
  availability: true,
  prepMinutes: true,
  categoryId: true,
  category: { select: { name: true, slug: true } },
  tags: { select: { tag: { select: { id: true, name: true, color: true, slug: true } } } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export type ProductListFilter = {
  categorySlug?: string;
  search?: string;
  tagSlugs?: string[];
  featuredOnly?: boolean;
  cursor?: string;
  take?: number;
};

export const productRepository = {
  /** Storefront listing: paginated, filterable, visible/active only. */
  async findMany(filter: ProductListFilter): Promise<{ items: ProductCard[]; nextCursor: string | null }> {
    const take = filter.take ?? 24;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      isVisible: true,
      ...(filter.featuredOnly ? { isFeatured: true } : {}),
      ...(filter.categorySlug
        ? { category: { slug: filter.categorySlug } }
        : {}),
      ...(filter.tagSlugs?.length
        ? { tags: { some: { tag: { slug: { in: filter.tagSlugs } } } } }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { shortDescription: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const items = await prisma.product.findMany({
      where,
      select: cardSelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: take + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;

    return {
      items: page,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  },

  async findFeatured(limit = 8): Promise<ProductCard[]> {
    return prisma.product.findMany({
      where: { isActive: true, isVisible: true, isFeatured: true },
      select: cardSelect,
      orderBy: { sortOrder: 'asc' },
      take: limit,
    });
  },

  async findBestSellers(limit = 8): Promise<ProductCard[]> {
    return prisma.product.findMany({
      where: { isActive: true, isVisible: true, soldCount: { gt: 0 } },
      select: cardSelect,
      orderBy: { soldCount: 'desc' },
      take: limit,
    });
  },

  async findBySlug(slug: string): Promise<ProductDetail | null> {
    return prisma.product.findUnique({
      where: { slug },
      include: productDetailInclude,
    });
  },

  async findById(id: string): Promise<ProductDetail | null> {
    return prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
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

  async findAllForAdmin(params: { search?: string; categoryId?: string; skip?: number; take?: number }) {
    const where: Prisma.ProductWhereInput = {
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.search
        ? { name: { contains: params.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          ...cardSelect,
          isActive: true,
          isVisible: true,
          sku: true,
          soldCount: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 25,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  },

  async create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({ data, include: productDetailInclude });
  },

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data, include: productDetailInclude });
  },

  /**
   * Replaces every nested relation (images, tags, ingredients, variant
   * groups + options, extras) and updates scalar fields in one transaction.
   * Simpler and just as correct as diffing individual rows for an admin form
   * that always submits the full nested shape.
   */
  async updateWithRelations(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productTag.deleteMany({ where: { productId: id } });
      await tx.productIngredient.deleteMany({ where: { productId: id } });
      await tx.variantGroup.deleteMany({ where: { productId: id } });
      await tx.productExtra.deleteMany({ where: { productId: id } });

      return tx.product.update({ where: { id }, data, include: productDetailInclude });
    });
  },

  async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },

  async setAvailability(id: string, availability: Prisma.ProductUpdateInput['availability']) {
    return prisma.product.update({ where: { id }, data: { availability } });
  },

  async duplicate(id: string) {
    const original = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        tags: true,
        ingredients: true,
        variantGroups: { include: { options: true } },
        extras: true,
      },
    });
    if (!original) return null;

    return prisma.product.create({
      data: {
        name: `${original.name} (copia)`,
        slug: `${original.slug}-copia-${Date.now().toString(36)}`,
        shortDescription: original.shortDescription,
        description: original.description,
        image: original.image,
        price: original.price,
        offerPrice: original.offerPrice,
        isActive: false,
        isVisible: false,
        isFeatured: false,
        prepMinutes: original.prepMinutes,
        allowNotes: original.allowNotes,
        categoryId: original.categoryId,
        images: {
          create: original.images.map((image) => ({
            url: image.url,
            alt: image.alt,
            sortOrder: image.sortOrder,
          })),
        },
        tags: { create: original.tags.map((tag) => ({ tagId: tag.tagId })) },
        ingredients: {
          create: original.ingredients.map((ingredient) => ({
            ingredientId: ingredient.ingredientId,
            isRemovable: ingredient.isRemovable,
          })),
        },
        variantGroups: {
          create: original.variantGroups.map((group) => ({
            name: group.name,
            selectionType: group.selectionType,
            isRequired: group.isRequired,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
            options: {
              create: group.options.map((option) => ({
                name: option.name,
                priceDelta: option.priceDelta,
                isDefault: option.isDefault,
                isAvailable: option.isAvailable,
                sortOrder: option.sortOrder,
              })),
            },
          })),
        },
        extras: {
          create: original.extras.map((extra) => ({
            extraId: extra.extraId,
            priceOverride: extra.priceOverride,
            maxQuantity: extra.maxQuantity,
            sortOrder: extra.sortOrder,
          })),
        },
      },
      include: productDetailInclude,
    });
  },
};
