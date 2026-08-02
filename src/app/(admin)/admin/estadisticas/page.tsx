import Link from 'next/link';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ClipboardList, DollarSign, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { StatCard } from '@/features/admin/stat-card';
import { DailyRevenueChart, OrdersByHourChart, TopCategoriesChart } from '@/features/admin/stats-charts';
import { analyticsRepository } from '@/server/repositories/analytics.repository';

export const metadata = { title: 'Estadísticas' };

const RANGES = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
] as const;

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = RANGES.some((r) => r.value === range) ? Number(range) : 30;

  const to = endOfDay(new Date());
  const from = startOfDay(subDays(to, days - 1));

  const [summary, dailySeries, ordersByHour, topCategories, topCustomers] = await Promise.all([
    analyticsRepository.salesBetween(from, to),
    analyticsRepository.dailySeries(from, to),
    analyticsRepository.ordersByHour(from, to),
    analyticsRepository.topCategories(from, to),
    analyticsRepository.topCustomers(10),
  ]);

  const dailyPoints = dailySeries.map((row) => ({
    day: format(new Date(row.day), 'dd/MM'),
    revenue: Number(row.revenue),
    orders: Number(row.orders),
  }));

  const hourPoints = Array.from({ length: 24 }, (_, hour) => {
    const found = ordersByHour.find((row) => row.hour === hour);
    return { hour, orders: found ? Number(found.orders) : 0 };
  });

  const categoryPoints = topCategories.map((row) => ({
    category: row.category,
    revenue: Number(row.revenue),
    units: Number(row.units),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Estadísticas</h1>
        <div className="border-border bg-card flex rounded-lg border p-1">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/admin/estadisticas?range=${r.value}`}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                days === Number(r.value) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={DollarSign} label={`Ventas (${days}d)`} value={formatMoney(summary.revenue)} />
        <StatCard icon={ClipboardList} label={`Pedidos (${days}d)`} value={String(summary.orderCount)} />
        <StatCard icon={Receipt} label="Ticket promedio" value={formatMoney(summary.averageTicket)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyRevenueChart data={dailyPoints} />
        <OrdersByHourChart data={hourPoints} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopCategoriesChart data={categoryPoints} />

        <div className="border-border bg-card rounded-2xl border p-4">
          <h2 className="font-display mb-4 text-lg font-semibold">Clientes frecuentes</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Total gastado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center">
                    Sin datos todavía.
                  </TableCell>
                </TableRow>
              ) : (
                topCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      {customer.firstName} {customer.lastName}
                      <span className="text-muted-foreground block text-xs">{customer.phone}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{customer.orderCount}</Badge>
                    </TableCell>
                    <TableCell>{formatMoney(customer.totalSpent)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
