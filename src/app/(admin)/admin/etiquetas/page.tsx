import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tagRepository } from '@/server/repositories/catalog-support.repository';
import { deleteTagAction } from '@/server/actions/catalog-support.actions';
import { DeleteEntityButton } from '@/features/admin/delete-entity-button';

export const metadata = { title: 'Etiquetas' };

export default async function AdminTagsPage() {
  const tags = await tagRepository.findAllForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Etiquetas</h1>
        <Button asChild>
          <Link href="/admin/etiquetas/nuevo">
            <Plus className="size-4" />
            Nueva etiqueta
          </Link>
        </Button>
      </div>

      <div className="border-border bg-card rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  No hay etiquetas todavía.
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <Badge className="border-none text-white" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                    </Badge>
                  </TableCell>
                  <TableCell>{tag._count.products}</TableCell>
                  <TableCell>
                    <Badge variant={tag.isActive ? 'secondary' : 'outline'}>{tag.isActive ? 'Activa' : 'Inactiva'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/etiquetas/${tag.id}`}>Editar</Link>
                      </Button>
                      <DeleteEntityButton
                        id={tag.id}
                        name={tag.name}
                        description="Solo es posible si no está asociada a productos."
                        action={deleteTagAction}
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
