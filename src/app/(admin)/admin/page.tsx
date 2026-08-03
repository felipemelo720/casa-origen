import { startOfDay, subDays } from 'date-fns';
import { DollarSign, Receipt, ShoppingBag } from 'lucide-react';

import { isAdminAuthenticated } from '@/lib/auth/admin-session';
import {
  loginAction,
  logoutAction,
  toggleAcceptingOrdersAction,
  toggleDeliveryAction,
  setProductAvailabilityAction,
} from '@/server/actions/admin.actions';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { productRepository } from '@/server/repositories/product.repository';
import { analyticsRepository } from '@/server/repositories/analytics.repository';
import { StatCard } from '@/features/admin/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="border-border bg-card w-full max-w-sm rounded-2xl border p-8">
          <h1 className="font-display text-3xl font-bold">Admin</h1>
          <p className="text-muted-foreground mb-8 text-sm">Casa Origen — panel de control</p>
          <form action={loginAction} className="space-y-4">
            <Input name="password" type="password" placeholder="Contraseña" required autoFocus />
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const [settings, products] = await Promise.all([
    settingsRepository.get(),
    productRepository.findAllForAvailabilityToggle(),
  ]);

  const categories = new Map<string, { categoryName: string; products: typeof products }>();
  for (const product of products) {
    const bucket = categories.get(product.category.id) ?? {
      categoryName: product.category.name,
      products: [],
    };
    bucket.products.push(product);
    categories.set(product.category.id, bucket);
  }

  const since = startOfDay(subDays(new Date(), 6));
  const [sales, dailySeries] = await Promise.all([
    analyticsRepository.salesBetween(since, new Date()),
    analyticsRepository.dailySeries(since, new Date()),
  ]);

  return (
    <main className="min-h-dvh px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Admin</h1>
            <p className="text-muted-foreground text-xs">Casa Origen</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Salir
            </Button>
          </form>
        </div>

        {/* Store status */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6">
          <div>
            <p className="text-muted-foreground text-xs tracking-widest uppercase">Estado del negocio</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn('size-2.5 rounded-full', settings.acceptingOrders ? 'bg-green-500' : 'bg-red-500')}
              />
              <span className="font-display text-xl font-bold">
                {settings.acceptingOrders ? 'ABIERTO' : 'CERRADO'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form action={toggleAcceptingOrdersAction.bind(null, true)}>
              <Button
                type="submit"
                disabled={settings.acceptingOrders}
                variant="outline"
                className="w-full border-green-500/40 text-green-600 disabled:opacity-40"
              >
                Abrir negocio
              </Button>
            </form>
            <form action={toggleAcceptingOrdersAction.bind(null, false)}>
              <Button
                type="submit"
                disabled={!settings.acceptingOrders}
                variant="outline"
                className="w-full border-red-500/40 text-red-600 disabled:opacity-40"
              >
                Cerrar negocio
              </Button>
            </form>
          </div>
        </section>

        {/* Delivery */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6">
          <div>
            <p className="text-muted-foreground text-xs tracking-widest uppercase">Delivery</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn('size-2.5 rounded-full', settings.deliveryEnabled ? 'bg-green-500' : 'bg-red-500')}
              />
              <span className="font-display text-xl font-bold">
                {settings.deliveryEnabled ? 'DISPONIBLE' : 'NO DISPONIBLE'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form action={toggleDeliveryAction.bind(null, true)}>
              <Button
                type="submit"
                disabled={settings.deliveryEnabled}
                variant="outline"
                className="w-full border-green-500/40 text-green-600 disabled:opacity-40"
              >
                Activar delivery
              </Button>
            </form>
            <form action={toggleDeliveryAction.bind(null, false)}>
              <Button
                type="submit"
                disabled={!settings.deliveryEnabled}
                variant="outline"
                className="w-full border-red-500/40 text-red-600 disabled:opacity-40"
              >
                Desactivar delivery
              </Button>
            </form>
          </div>
        </section>

        {/* Menu availability */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6">
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Disponibilidad del menú</p>
          {[...categories.values()].map(({ categoryName, products: categoryProducts }) => (
            <div key={categoryName} className="space-y-2">
              <p className="text-muted-foreground/70 text-[10px] tracking-widest uppercase">{categoryName}</p>
              <div className="space-y-1.5">
                {categoryProducts.map((product) => {
                  const isUnavailable = product.availability === 'OUT_OF_STOCK';
                  return (
                    <form
                      key={product.id}
                      action={setProductAvailabilityAction.bind(null, product.id, isUnavailable)}
                      className="bg-background border-border flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn('size-2 shrink-0 rounded-full', isUnavailable ? 'bg-red-500' : 'bg-green-500')}
                        />
                        <span className="truncate text-sm">{product.name}</span>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className={cn(
                          'shrink-0',
                          isUnavailable ? 'border-green-500/40 text-green-600' : 'border-red-500/40 text-red-600',
                        )}
                      >
                        {isUnavailable ? 'Activar' : 'Agotar'}
                      </Button>
                    </form>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Stats */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6">
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Últimos 7 días</p>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={DollarSign} label="Ventas" value={formatMoney(sales.revenue)} />
            <StatCard icon={ShoppingBag} label="Pedidos" value={String(sales.orderCount)} />
            <StatCard icon={Receipt} label="Ticket prom." value={formatMoney(sales.averageTicket)} />
          </div>
          <div className="space-y-1.5">
            {dailySeries.map((day) => (
              <div key={day.day.toISOString()} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {day.day.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
                </span>
                <span>{Number(day.orders)} pedidos</span>
                <span className="font-medium">{formatMoney(Number(day.revenue))}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
