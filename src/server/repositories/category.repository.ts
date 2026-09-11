import 'server-only';

import { prisma } from '@/lib/db/prisma';

/**
 * Repositorio mínimo: hoy solo alimenta el `<select>` de categoría del CRUD
 * de productos. Se había borrado por no tener caller (ver `PLAN.md`); vuelve
 * porque ahora sí lo tiene.
 */
export const categoryRepository = {
  async findAllActive() {
    return prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
  },
};
