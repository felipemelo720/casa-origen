'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';

import { permissionAction } from '@/server/actions/action-builder';
import { categoryRepository } from '@/server/repositories/category.repository';
import { categorySchema } from '@/schemas/category.schema';
import { permission } from '@/constants/permissions';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';

function toCreateData(input: z.infer<typeof categorySchema>) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description || undefined,
    image: input.image || undefined,
    icon: input.icon || undefined,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    ...(input.parentId ? { parent: { connect: { id: input.parentId } } } : {}),
  };
}

export const createCategoryAction = permissionAction(
  { name: 'category.create', permissions: [permission('category', 'create')] },
  categorySchema,
  async (input) => {
    const existing = await categoryRepository.findBySlug(input.slug);
    if (existing) throw new ConflictError('Ya existe una categoría con ese slug.');

    const category = await categoryRepository.create(toCreateData(input));
    revalidateTag('categories');
    return { id: category.id };
  },
);

export const updateCategoryAction = permissionAction(
  { name: 'category.update', permissions: [permission('category', 'update')] },
  categorySchema.extend({ id: z.string().min(1) }),
  async (input) => {
    const existing = await categoryRepository.findById(input.id);
    if (!existing) throw new NotFoundError('La categoría');

    if (input.parentId === input.id) {
      throw new BusinessRuleError('Una categoría no puede ser su propio padre.');
    }

    const slugTaken = await categoryRepository.findBySlug(input.slug);
    if (slugTaken && slugTaken.id !== input.id) {
      throw new ConflictError('Ya existe una categoría con ese slug.');
    }

    await categoryRepository.update(input.id, toCreateData(input));
    revalidateTag('categories');
    return { id: input.id };
  },
);

export const deleteCategoryAction = permissionAction(
  { name: 'category.delete', permissions: [permission('category', 'delete')] },
  z.object({ id: z.string().min(1) }),
  async ({ id }) => {
    const [productCount, childCount] = await Promise.all([
      categoryRepository.countProducts(id),
      categoryRepository.countChildren(id),
    ]);

    if (productCount > 0) {
      throw new BusinessRuleError('No puedes eliminar una categoría con productos asociados.');
    }
    if (childCount > 0) {
      throw new BusinessRuleError('No puedes eliminar una categoría con subcategorías.');
    }

    await categoryRepository.delete(id);
    revalidateTag('categories');
    return { id };
  },
);
