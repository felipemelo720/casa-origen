import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { categoryRepository } from '@/server/repositories/category.repository';
import { DeleteEntityButton } from '@/features/admin/delete-entity-button';
import { deleteCategoryAction } from '@/server/actions/category.actions';

export const metadata = { title: 'Categorías' };

export default async function AdminCategoriesPage() {
  const categories = await categoryRepository.findAllForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Categorías</h1>
        <Button asChild>
          <Link href="/admin/categorias/nuevo">
            <Plus className="size-4" />
            Nueva categoría
          </Link>
        </Button>
      </div>

      <div className="border-border bg-card rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Padre</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No hay categorías todavía.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">{category.parent?.name ?? '—'}</TableCell>
                  <TableCell>{category._count.products}</TableCell>
                  <TableCell>
                    <Badge variant={category.isActive ? 'secondary' : 'outline'}>
                      {category.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/categorias/${category.id}`}>Editar</Link>
                      </Button>
                      <DeleteEntityButton
                        id={category.id}
                        name={category.name}
                        description="Solo es posible si la categoría no tiene productos ni subcategorías."
                        action={deleteCategoryAction}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
