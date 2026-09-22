import { startOfDay, subDays } from 'date-fns';
import Link from 'next/link';
import { DollarSign, Receipt, ShoppingBag, Star } from 'lucide-react';

import { isAdminAuthenticated } from '@/lib/auth/admin-session';
import {
  loginAction,
  toggleAcceptingOrdersAction,
  toggleDeliveryAction,
  setProductAvailabilityAction,
  setProductFeaturedAction,
} from '@/server/actions/admin.actions';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { HIGHLIGHTED_LIMIT, productRepository } from '@/server/repositories/product.repository';
import { analyticsRepository } from '@/server/repositories/analytics.repository';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { AdminPageHeader } from '@/features/admin/admin-page-header';
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
          <AdminForm action={loginAction} className="space-y-4">
            <Input name="password" type="password" placeholder="Contraseña" required autoFocus />
            <AdminSubmit className="w-full" pendingLabel="Entrando…">
              Entrar
            </AdminSubmit>
          </AdminForm>
        </div>
      </main>
    );
  }

  // Un solo `Promise.all`: antes las métricas esperaban a que terminara la
  // primera tanda de consultas.
  const since = startOfDay(subDays(new Date(), 6));
  const [settings, products, sales, dailySeries] = await Promise.all([
    settingsRepository.get(),
    productRepository.findAllForAvailabilityToggle(),
    analyticsRepository.salesBetween(since, new Date()),
    analyticsRepository.dailySeries(since, new Date()),
  ]);

  const featuredCount = products.filter((product) => product.isFeatured).length;

  const categories = new Map<string, { categoryName: string; products: typeof products }>();
  for (const product of products) {
    const bucket = categories.get(product.category.id) ?? {
      categoryName: product.category.name,
      products: [],
    };
    bucket.products.push(product);
    categories.set(product.category.id, bucket);
  }

  /*
    Orden por frecuencia de uso durante el turno: abrir/cerrar y delivery
    arriba (un toque), después cómo va la semana, y abajo agotar/destacar.
    Lo que se configura una vez vive en Ajustes y Cupones.

    `[&>section]:min-w-0` no es cosmético: un grid item nace con
    `min-width: auto` y el track crece hasta el `min-content` del hijo más
    ancho — a 360px eso metía scroll horizontal en toda la página.
  */
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader title="Hoy" description="Lo que se toca durante el turno." />

      <div className="grid gap-4 sm:grid-cols-2 [&>section]:min-w-0">
        <section
          aria-label="Estado del negocio"
          className="border-border bg-card rounded-2xl border"
        >
          <div className="flex h-full flex-col justify-between gap-4 p-4 sm:p-6">
            <div>
              <p className="text-muted-foreground text-xs tracking-widest uppercase">
                Estado del negocio
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    'size-2.5 rounded-full',
                    settings.acceptingOrders ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
                <span className="font-display text-xl font-bold">
                  {settings.acceptingOrders ? 'ABIERTO' : 'CERRADO'}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                Manda sobre los horarios: abierto acá es abierto en la web, aunque sea fuera de
                horario. Nada cierra solo.
              </p>
            </div>
            <AdminForm
              action={toggleAcceptingOrdersAction.bind(null, !settings.acceptingOrders)}
              className="space-y-2"
            >
              <AdminSubmit
                variant="outline"
                pendingLabel="Cambiando…"
                className={cn(
                  'h-11 w-full',
                  settings.acceptingOrders
                    ? 'border-red-500/40 text-red-600'
                    : 'border-green-500/40 text-green-600',
                )}
              >
                {settings.acceptingOrders ? 'Cerrar negocio' : 'Abrir negocio'}
              </AdminSubmit>
            </AdminForm>
          </div>
        </section>
        <section aria-label="Delivery" className="border-border bg-card rounded-2xl border">
          <div className="flex h-full flex-col justify-between gap-4 p-4 sm:p-6">
            <div>
              <p className="text-muted-foreground text-xs tracking-widest uppercase">Delivery</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    'size-2.5 rounded-full',
                    settings.deliveryEnabled ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
                <span className="font-display text-xl font-bold">
                  {settings.deliveryEnabled ? 'DISPONIBLE' : 'NO DISPONIBLE'}
                </span>
              </div>
            </div>
            <AdminForm
              action={toggleDeliveryAction.bind(null, !settings.deliveryEnabled)}
              className="space-y-2"
            >
              <AdminSubmit
                variant="outline"
                pendingLabel="Cambiando…"
                className={cn(
                  'h-11 w-full',
                  settings.deliveryEnabled
                    ? 'border-red-500/40 text-red-600'
                    : 'border-green-500/40 text-green-600',
                )}
              >
                {settings.deliveryEnabled ? 'Desactivar delivery' : 'Activar delivery'}
              </AdminSubmit>
            </AdminForm>
          </div>
        </section>
      </div>

      <section aria-labelledby="semana" className="space-y-3">
        <h2 id="semana" className="text-muted-foreground text-xs tracking-widest uppercase">
          Últimos 7 días
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={DollarSign} label="Ventas" value={formatMoney(sales.revenue)} />
          <StatCard icon={ShoppingBag} label="Pedidos" value={String(sales.orderCount)} />
          <StatCard icon={Receipt} label="Ticket prom." value={formatMoney(sales.averageTicket)} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start [&>section]:min-w-0">
        <section className="border-border bg-card space-y-4 rounded-2xl border p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs tracking-widest uppercase">Menú</p>
              <p className="text-muted-foreground text-xs">
                <Star className="mr-1 inline size-3" />
                destaca el producto en «Los más pedidos» de la portada.{' '}
                {featuredCount === 0
                  ? `Sin ninguno destacado se muestran los ${HIGHLIGHTED_LIMIT} más vendidos.`
                  : `${featuredCount} destacado${featuredCount === 1 ? '' : 's'}.`}
              </p>
              {featuredCount > HIGHLIGHTED_LIMIT && (
                <p className="text-xs font-medium text-amber-600">
                  La portada solo muestra {HIGHLIGHTED_LIMIT}: sobran{' '}
                  {featuredCount - HIGHLIGHTED_LIMIT}.
                </p>
              )}
            </div>
            {/* Agotar/destacar es el toque diario; crear, editar y
                eliminar vive en Productos. */}
            <Button asChild variant="outline" size="sm" className="h-11 shrink-0">
              <Link href="/admin/productos">Gestionar</Link>
            </Button>
          </div>
          {[...categories.values()].map(({ categoryName, products: categoryProducts }) => (
            <div key={categoryName} className="space-y-2">
              <p className="text-muted-foreground/70 text-[10px] tracking-widest uppercase">
                {categoryName}
              </p>
              <div className="border-border divide-border bg-background divide-y overflow-hidden rounded-xl border xl:grid xl:grid-cols-2 xl:divide-y-0">
                {categoryProducts.map((product, index) => {
                  const isUnavailable = product.availability === 'OUT_OF_STOCK';
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'border-border flex items-center justify-between gap-3 px-3 py-2',
                        // En dos columnas el `divide-y` del padre no separa filas:
                        // el borde lo pone cada celda salvo la primera de su columna.
                        'xl:border-t',
                        index < 2 && 'xl:border-t-0',
                        index % 2 === 1 && 'xl:border-l',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            isUnavailable ? 'bg-red-500' : 'bg-green-500',
                          )}
                        />
                        <span className="truncate text-sm">{product.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {/* Separate forms: nesting one inside the other is invalid HTML. */}
                        {/* `toast`, no línea inline: son botones de ícono dentro
                            de una fila angosta y un párrafo extra la
                            descuadraría entera. */}
                        <AdminForm
                          feedback="toast"
                          action={setProductFeaturedAction.bind(
                            null,
                            product.id,
                            !product.isFeatured,
                          )}
                        >
                          <AdminSubmit
                            size="icon"
                            variant="outline"
                            pendingLabel=""
                            title={
                              product.isFeatured ? 'Quitar de destacados' : 'Destacar en la portada'
                            }
                            aria-label={
                              product.isFeatured ? 'Quitar de destacados' : 'Destacar en la portada'
                            }
                            className={cn(
                              'size-11',
                              product.isFeatured && 'border-amber-500/40 text-amber-600',
                            )}
                          >
                            <Star className={cn('size-4', product.isFeatured && 'fill-current')} />
                          </AdminSubmit>
                        </AdminForm>
                        <AdminForm
                          feedback="toast"
                          action={setProductAvailabilityAction.bind(
                            null,
                            product.id,
                            isUnavailable,
                          )}
                        >
                          <AdminSubmit
                            variant="outline"
                            pendingLabel="…"
                            className={cn(
                              'h-11 px-3',
                              isUnavailable
                                ? 'border-green-500/40 text-green-600'
                                : 'border-red-500/40 text-red-600',
                            )}
                          >
                            {isUnavailable ? 'Activar' : 'Agotar'}
                          </AdminSubmit>
                        </AdminForm>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="border-border bg-card space-y-3 rounded-2xl border p-4 sm:p-6">
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Día a día</p>
          <div className="divide-border/60 divide-y">
            {dailySeries.map((day) => (
              <div
                key={day.day.toISOString()}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1.5 text-sm"
              >
                <span className="text-muted-foreground truncate">
                  {day.day.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Number(day.orders)} pedidos
                </span>
                <span className="w-20 text-right font-medium tabular-nums">
                  {formatMoney(Number(day.revenue))}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
