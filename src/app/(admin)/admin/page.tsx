import Link from 'next/link';
import { startOfDay, endOfDay } from 'date-fns';
import { ArrowRight, ClipboardList, DollarSign, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/money';
import { ORDER_STATUS_LABEL } from '@/constants/order-status';
import { StatCard } from '@/features/admin/stat-card';
import { analyticsRepository } from '@/server/repositories/analytics.repository';
import { orderRepository } from '@/server/repositories/order.repository';

export const metadata = { title: 'Dashboard' };

const ACTIVE_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as const;

export default async function AdminDashboardPage() {
  const now = new Date();
  const [salesToday, activeOrders] = await Promise.all([
    analyticsRepository.salesBetween(startOfDay(now), endOfDay(now)),
    orderRepository.findMany({ status: [...ACTIVE_STATUSES], take: 8 }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={DollarSign} label="Ventas hoy" value={formatMoney(salesToday.revenue)} />
        <StatCard icon={ClipboardList} label="Pedidos activos" value={String(activeOrders.total)} />
        <StatCard icon={Receipt} label="Ticket promedio (hoy)" value={formatMoney(salesToday.averageTicket)} />
      </div>

      <section className="border-border bg-card rounded-2xl border">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-display text-lg font-semibold">Pedidos activos</h2>
          <Link href="/admin/pedidos" className="text-primary flex items-center gap-1 text-sm font-medium">
            Ver todos <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeOrders.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  No hay pedidos activos.
                </TableCell>
              </TableRow>
            ) : (
              activeOrders.items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.code}</TableCell>
                  <TableCell>
                    {order.firstName} {order.lastName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ORDER_STATUS_LABEL[order.status]}</Badge>
                  </TableCell>
                  <TableCell>{formatMoney(order.total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
