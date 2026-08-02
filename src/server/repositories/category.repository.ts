import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

const treeSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  icon: true,
  isActive: true,
  sortOrder: true,
  parentId: true,
} satisfies Prisma.CategorySelect;

export type CategoryTreeNode = Prisma.CategoryGetPayload<{ select: typeof treeSelect }> & {
  children: CategoryTreeNode[];
};

export const categoryRepository = {
  /** Root categories with their children, ordered for menu rendering. */
  async findMenuTree(): Promise<CategoryTreeNode[]> {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: treeSelect,
      orderBy: { sortOrder: 'asc' },
    });

    const byParent = new Map<string | null, CategoryTreeNode[]>();
    for (const category of categories) {
      const node: CategoryTreeNode = { ...category, children: [] };
      const bucket = byParent.get(category.parentId) ?? [];
      bucket.push(node);
      byParent.set(category.parentId, bucket);
    }

    function attachChildren(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
      for (const node of nodes) {
        node.children = attachChildren(byParent.get(node.id) ?? []);
      }
      return nodes;
    }

    return attachChildren(byParent.get(null) ?? []);
  },

  async findAllForAdmin() {
    return prisma.category.findMany({
      select: {
        ...treeSelect,
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    });
  },

  async findBySlug(slug: string) {
    return prisma.category.findUnique({ where: { slug } });
  },

  async findById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  async create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },

  async countProducts(id: string) {
    return prisma.product.count({ where: { categoryId: id } });
  },

  async countChildren(id: string) {
    return prisma.category.count({ where: { parentId: id } });
  },
};
