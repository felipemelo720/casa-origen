'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';

import { permissionAction } from '@/server/actions/action-builder';
import { productRepository } from '@/server/repositories/product.repository';
import { productSchema, productWithIdSchema, type ProductInput } from '@/schemas/product.schema';
import { permission } from '@/constants/permissions';
import { ConflictError, NotFoundError } from '@/lib/errors';

function nestedRelationsData(input: ProductInput) {
  return {
    images: {
      create: input.images.map((image, index) => ({
        url: image.url,
        alt: image.alt || undefined,
        sortOrder: index,
      })),
    },
    tags: { create: input.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
    ingredients: {
      create: input.ingredients.map((entry) => ({
        ingredient: { connect: { id: entry.ingredientId } },
        isRemovable: entry.isRemovable,
      })),
    },
    variantGroups: {
      create: input.variantGroups.map((group, groupIndex) => ({
        name: group.name,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sortOrder: groupIndex,
        options: {
          create: group.options.map((option, optionIndex) => ({
            name: option.name,
            priceDelta: option.priceDelta,
            isDefault: option.isDefault,
            isAvailable: option.isAvailable,
            sortOrder: optionIndex,
          })),
        },
      })),
    },
    extras: {
      create: input.extras.map((entry, index) => ({
        extra: { connect: { id: entry.extraId } },
        priceOverride: entry.priceOverride,
        maxQuantity: entry.maxQuantity,
        sortOrder: index,
      })),
    },
  };
}

function scalarData(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    shortDescription: input.shortDescription || undefined,
    description: input.description || undefined,
    image: input.images[0]?.url,
    price: input.price,
    offerPrice: input.offerPrice ?? null,
    availability: input.availability,
    prepMinutes: input.prepMinutes,
    allowNotes: input.allowNotes,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    isVisible: input.isVisible,
    isFeatured: input.isFeatured,
  };
}

export const createProductAction = permissionAction(
  { name: 'product.create', permissions: [permission('product', 'create')] },
  productSchema,
  async (input) => {
    const existing = await productRepository.findBySlug(input.slug);
    if (existing) throw new ConflictError('Ya existe un producto con ese slug.');

    const product = await productRepository.create({
      ...scalarData(input),
      category: { connect: { id: input.categoryId } },
      ...nestedRelationsData(input),
    });

    revalidateTag('products');
    return { id: product.id };
  },
);

export const updateProductAction = permissionAction(
  { name: 'product.update', permissions: [permission('product', 'update')] },
  productWithIdSchema,
  async (input) => {
    const existing = await productRepository.findById(input.id);
    if (!existing) throw new NotFoundError('El producto');

    const slugTaken = await productRepository.findBySlug(input.slug);
    if (slugTaken && slugTaken.id !== input.id) {
      throw new ConflictError('Ya existe un producto con ese slug.');
    }

    await productRepository.updateWithRelations(input.id, {
      ...scalarData(input),
      category: { connect: { id: input.categoryId } },
      ...nestedRelationsData(input),
    });

    revalidateTag('products');
    return { id: input.id };
  },
);

export const deleteProductAction = permissionAction(
  { name: 'product.delete', permissions: [permission('product', 'delete')] },
  z.object({ id: z.string().min(1) }),
  async ({ id }) => {
    await productRepository.delete(id);
    revalidateTag('products');
    return { id };
  },
);

export const duplicateProductAction = permissionAction(
  { name: 'product.duplicate', permissions: [permission('product', 'create')] },
  z.object({ id: z.string().min(1) }),
  async ({ id }) => {
    const duplicate = await productRepository.duplicate(id);
    if (!duplicate) throw new NotFoundError('El producto');
    revalidateTag('products');
    return { id: duplicate.id };
  },
);
