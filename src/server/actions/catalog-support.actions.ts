'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';

import { permissionAction } from '@/server/actions/action-builder';
import { extraRepository, tagRepository, ingredientRepository } from '@/server/repositories/catalog-support.repository';
import { extraSchema, tagSchema, ingredientSchema } from '@/schemas/catalog-support.schema';
import { permission } from '@/constants/permissions';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';

const idSchema = z.object({ id: z.string().min(1) });

function cleanupText(value: string) {
  return value || undefined;
}

// --- Extras ----------------------------------------------------------------

export const createExtraAction = permissionAction(
  { name: 'extra.create', permissions: [permission('extra', 'create')] },
  extraSchema,
  async (input) => {
    const extra = await extraRepository.create({
      name: input.name,
      slug: input.slug,
      description: cleanupText(input.description ?? ''),
      price: input.price,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    });
    revalidateTag('products');
    return { id: extra.id };
  },
);

export const updateExtraAction = permissionAction(
  { name: 'extra.update', permissions: [permission('extra', 'update')] },
  extraSchema.extend({ id: z.string().min(1) }),
  async (input) => {
    const existing = await extraRepository.findById(input.id);
    if (!existing) throw new NotFoundError('El extra');

    await extraRepository.update(input.id, {
      name: input.name,
      slug: input.slug,
      description: cleanupText(input.description ?? ''),
      price: input.price,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    });
    revalidateTag('products');
    return { id: input.id };
  },
);

export const deleteExtraAction = permissionAction(
  { name: 'extra.delete', permissions: [permission('extra', 'delete')] },
  idSchema,
  async ({ id }) => {
    try {
      await extraRepository.delete(id);
    } catch {
      throw new BusinessRuleError('No puedes eliminar un extra usado por productos.');
    }
    revalidateTag('products');
    return { id };
  },
);

// --- Tags --------------------------------------------------------------------

export const createTagAction = permissionAction(
  { name: 'tag.create', permissions: [permission('tag', 'create')] },
  tagSchema,
  async (input) => {
    const tag = await tagRepository.create({
      name: input.name,
      slug: input.slug,
      color: input.color,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    });
    revalidateTag('products');
    return { id: tag.id };
  },
);

export const updateTagAction = permissionAction(
  { name: 'tag.update', permissions: [permission('tag', 'update')] },
  tagSchema.extend({ id: z.string().min(1) }),
  async (input) => {
    const existing = await tagRepository.findById(input.id);
    if (!existing) throw new NotFoundError('La etiqueta');

    await tagRepository.update(input.id, {
      name: input.name,
      slug: input.slug,
      color: input.color,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    });
    revalidateTag('products');
    return { id: input.id };
  },
);

export const deleteTagAction = permissionAction(
  { name: 'tag.delete', permissions: [permission('tag', 'delete')] },
  idSchema,
  async ({ id }) => {
    try {
      await tagRepository.delete(id);
    } catch {
      throw new BusinessRuleError('No puedes eliminar una etiqueta usada por productos.');
    }
    revalidateTag('products');
    return { id };
  },
);

// --- Ingredients ---------------------------------------------------------------

export const createIngredientAction = permissionAction(
  { name: 'ingredient.create', permissions: [permission('ingredient', 'create')] },
  ingredientSchema,
  async (input) => {
    const ingredient = await ingredientRepository.create({
      name: input.name,
      slug: input.slug,
      isAllergen: input.isAllergen,
      isActive: input.isActive,
    });
    revalidateTag('products');
    return { id: ingredient.id };
  },
);

export const updateIngredientAction = permissionAction(
  { name: 'ingredient.update', permissions: [permission('ingredient', 'update')] },
  ingredientSchema.extend({ id: z.string().min(1) }),
  async (input) => {
    const existing = await ingredientRepository.findById(input.id);
    if (!existing) throw new NotFoundError('El ingrediente');

    await ingredientRepository.update(input.id, {
      name: input.name,
      slug: input.slug,
      isAllergen: input.isAllergen,
      isActive: input.isActive,
    });
    revalidateTag('products');
    return { id: input.id };
  },
);

export const deleteIngredientAction = permissionAction(
  { name: 'ingredient.delete', permissions: [permission('ingredient', 'delete')] },
  idSchema,
  async ({ id }) => {
    try {
      await ingredientRepository.delete(id);
    } catch {
      throw new ConflictError('No puedes eliminar un ingrediente usado por productos.');
    }
    revalidateTag('products');
    return { id };
  },
);
