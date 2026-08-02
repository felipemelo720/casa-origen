import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ingredientRepository } from '@/server/repositories/catalog-support.repository';
import { deleteIngredientAction } from '@/server/actions/catalog-support.actions';
import { DeleteEntityButton } from '@/features/admin/delete-entity-button';

export const metadata = { title: 'Ingredientes' };

export default async function AdminIngredientsPage() {
  const ingredients = await ingredientRepository.findAllForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Ingredientes</h1>
        <Button asChild>
          <Link href="/admin/ingredientes/nuevo">
            <Plus className="size-4" />
            Nuevo ingrediente
          </Link>
        </Button>
      </div>

      <div className="border-border bg-card rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Alérgeno</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No hay ingredientes todavía.
                </TableCell>
              </TableRow>
            ) : (
              ingredients.map((ingredient) => (
                <TableRow key={ingredient.id}>
                  <TableCell className="font-medium">{ingredient.name}</TableCell>
                  <TableCell>{ingredient.isAllergen ? <Badge variant="destructive">Alérgeno</Badge> : '—'}</TableCell>
                  <TableCell>{ingredient._count.products}</TableCell>
                  <TableCell>
                    <Badge variant={ingredient.isActive ? 'secondary' : 'outline'}>{ingredient.isActive ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/ingredientes/${ingredient.id}`}>Editar</Link>
                      </Button>
                      <DeleteEntityButton
                        id={ingredient.id}
                        name={ingredient.name}
                        description="Solo es posible si no está asociado a productos."
                        action={deleteIngredientAction}
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
