import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/money';
import { extraRepository } from '@/server/repositories/catalog-support.repository';
import { deleteExtraAction } from '@/server/actions/catalog-support.actions';
import { DeleteEntityButton } from '@/features/admin/delete-entity-button';

export const metadata = { title: 'Extras' };

export default async function AdminExtrasPage() {
  const extras = await extraRepository.findAllForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Extras</h1>
        <Button asChild>
          <Link href="/admin/extras/nuevo">
            <Plus className="size-4" />
            Nuevo extra
          </Link>
        </Button>
      </div>

      <div className="border-border bg-card rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {extras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No hay extras todavía.
                </TableCell>
              </TableRow>
            ) : (
              extras.map((extra) => (
                <TableRow key={extra.id}>
                  <TableCell className="font-medium">{extra.name}</TableCell>
                  <TableCell>{formatMoney(extra.price)}</TableCell>
                  <TableCell>{extra._count.products}</TableCell>
                  <TableCell>
                    <Badge variant={extra.isActive ? 'secondary' : 'outline'}>{extra.isActive ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/extras/${extra.id}`}>Editar</Link>
                      </Button>
                      <DeleteEntityButton
                        id={extra.id}
                        name={extra.name}
                        description="Solo es posible si no está asociado a productos."
                        action={deleteExtraAction}
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
