import Link from 'next/link';
import Image from 'next/image';
import { Plus } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/money';
import { productRepository } from '@/server/repositories/product.repository';
import { categoryRepository } from '@/server/repositories/category.repository';
import { deleteProductAction } from '@/server/actions/product.actions';
import { DeleteEntityButton } from '@/features/admin/delete-entity-button';
import { DuplicateProductButton } from '@/features/admin/duplicate-product-button';

export const metadata = { title: 'Productos' };

const PAGE_SIZE = 25;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; page?: string }>;
}) {
  const { q, categoryId, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

  const [{ items, total }, categories] = await Promise.all([
    productRepository.findAllForAdmin({ search: q, categoryId, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    categoryRepository.findAllForAdmin(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Productos</h1>
        <Button asChild>
          <Link href="/admin/productos/nuevo">
            <Plus className="size-4" />
            Nuevo producto
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-3" action="/admin/productos" method="get">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre…" className="max-w-xs" />
        <Select name="categoryId" defaultValue={categoryId ?? 'ALL'}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <div className="border-border bg-card rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  No se encontraron productos.
                </TableCell>
              </TableRow>
            ) : (
              items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="bg-muted relative size-10 overflow-hidden rounded-md">
                      {product.image && <Image src={product.image} alt={product.name} fill className="object-cover" sizes="40px" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.category.name}</TableCell>
                  <TableCell>{formatMoney(product.offerPrice ?? product.price)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={product.isActive ? 'secondary' : 'outline'}>{product.isActive ? 'Activo' : 'Inactivo'}</Badge>
                      {!product.isVisible && <Badge variant="outline">Oculto</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/productos/${product.id}`}>Editar</Link>
                      </Button>
                      <DuplicateProductButton id={product.id} />
                      <DeleteEntityButton id={product.id} name={product.name} action={deleteProductAction} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages} · {total} productos
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/productos?${new URLSearchParams({ ...(q ? { q } : {}), ...(categoryId ? { categoryId } : {}), page: String(page - 1) })}`}>
                  Anterior
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
            )}
            {page < totalPages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/productos?${new URLSearchParams({ ...(q ? { q } : {}), ...(categoryId ? { categoryId } : {}), page: String(page + 1) })}`}>
                  Siguiente
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Siguiente
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
