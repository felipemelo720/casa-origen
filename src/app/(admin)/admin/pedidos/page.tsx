import Link from 'next/link';
import type { OrderStatus } from '@prisma/client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/money';
import { ORDER_STATUS_LABEL } from '@/constants/order-status';
import { orderRepository } from '@/server/repositories/order.repository';
import { nextStatuses } from '@/server/services/order-status.service';
import { OrderStatusSelect } from '@/features/admin/order-status-select';

export const metadata = { title: 'Pedidos' };

const ALL_STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
const PAGE_SIZE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

  const { items, total } = await orderRepository.findMany({
    status: status && ALL_STATUSES.includes(status as OrderStatus) ? [status as OrderStatus] : undefined,
    search: q,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Pedidos</h1>

      <form className="flex flex-wrap gap-3" action="/admin/pedidos" method="get">
        <Input name="q" defaultValue={q} placeholder="Buscar por código, nombre o teléfono…" className="max-w-xs" />
        <Select name="status" defaultValue={status ?? 'ALL'}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
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
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  No se encontraron pedidos.
                </TableCell>
              </TableRow>
            ) : (
              items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.code}</TableCell>
                  <TableCell>
                    {order.firstName} {order.lastName}
                    <span className="text-muted-foreground block text-xs">{order.phone}</span>
                  </TableCell>
                  <TableCell>{order.type === 'DELIVERY' ? 'Delivery' : 'Retiro'}</TableCell>
                  <TableCell>{order.paymentMethod.name}</TableCell>
                  <TableCell>{formatMoney(order.total)}</TableCell>
                  <TableCell>
                    <OrderStatusSelect
                      orderId={order.id}
                      status={order.status}
                      allowedNext={nextStatuses(order.status)}
                    />
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
            Página {page} de {totalPages} · {total} pedidos
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/admin/pedidos?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page - 1) })}`}
                >
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
                <Link
                  href={`/admin/pedidos?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page + 1) })}`}
                >
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
