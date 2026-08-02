import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

/** Extras, tags and ingredients: small reference tables shared across products. */
export const extraRepository = {
  async findAllActive() {
    return prisma.extra.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  },
  async findAllForAdmin() {
    return prisma.extra.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  },
  async findById(id: string) {
    return prisma.extra.findUnique({ where: { id } });
  },
  async create(data: Prisma.ExtraCreateInput) {
    return prisma.extra.create({ data });
  },
  async update(id: string, data: Prisma.ExtraUpdateInput) {
    return prisma.extra.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.extra.delete({ where: { id } });
  },
};

export const tagRepository = {
  async findAllActive() {
    return prisma.tag.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  },
  async findAllForAdmin() {
    return prisma.tag.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  },
  async findById(id: string) {
    return prisma.tag.findUnique({ where: { id } });
  },
  async create(data: Prisma.TagCreateInput) {
    return prisma.tag.create({ data });
  },
  async update(id: string, data: Prisma.TagUpdateInput) {
    return prisma.tag.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.tag.delete({ where: { id } });
  },
};

export const ingredientRepository = {
  async findAllActive() {
    return prisma.ingredient.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  },
  async findAllForAdmin() {
    return prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  },
  async findById(id: string) {
    return prisma.ingredient.findUnique({ where: { id } });
  },
  async create(data: Prisma.IngredientCreateInput) {
    return prisma.ingredient.create({ data });
  },
  async update(id: string, data: Prisma.IngredientUpdateInput) {
    return prisma.ingredient.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.ingredient.delete({ where: { id } });
  },
};

export const variantGroupRepository = {
  async create(data: Prisma.VariantGroupCreateInput) {
    return prisma.variantGroup.create({ data, include: { options: true } });
  },
  async update(id: string, data: Prisma.VariantGroupUpdateInput) {
    return prisma.variantGroup.update({ where: { id }, data, include: { options: true } });
  },
  async delete(id: string) {
    return prisma.variantGroup.delete({ where: { id } });
  },
  async createOption(data: Prisma.VariantOptionCreateInput) {
    return prisma.variantOption.create({ data });
  },
  async updateOption(id: string, data: Prisma.VariantOptionUpdateInput) {
    return prisma.variantOption.update({ where: { id }, data });
  },
  async deleteOption(id: string) {
    return prisma.variantOption.delete({ where: { id } });
  },
};
