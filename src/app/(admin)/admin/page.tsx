import { startOfDay, subDays } from 'date-fns';
import Link from 'next/link';
import { DollarSign, Receipt, ShoppingBag, Star, Store } from 'lucide-react';

import { isAdminAuthenticated } from '@/lib/auth/admin-session';
import {
  loginAction,
  logoutAction,
  toggleAcceptingOrdersAction,
  toggleDeliveryAction,
  setProductAvailabilityAction,
  setProductFeaturedAction,
  updateBusinessHoursAction,
  updateCommunesAction,
} from '@/server/actions/admin.actions';
import { communeRepository, settingsRepository } from '@/server/repositories/operations.repository';
import { HIGHLIGHTED_LIMIT, productRepository } from '@/server/repositories/product.repository';
import { analyticsRepository } from '@/server/repositories/analytics.repository';
import { getWeeklySchedule } from '@/server/services/schedule.service';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { StatCard } from '@/features/admin/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

/**
 * Un día cerrado se guarda como 00:00–00:00. Mostrar eso al destildar «Cerrado»
 * dejaría abrir el día con una ventana de cero minutos, así que el form parte de
 * un horario usable y el operador solo lo corrige si hace falta: el turno
 * partido real del local, 12:30–15:00 y 18:00–22:00.
 *
 * Solo se precargan en un día **cerrado**. En un día abierto con un turno
 * único, precargar el segundo le inventaría una franja al guardar.
 */
const FALLBACK_SHIFTS = [
  { opensAt: '12:30', closesAt: '15:00' },
  { opensAt: '18:00', closesAt: '22:00' },
] as const;

const EMPTY_SHIFT = { opensAt: '', closesAt: '' } as const;

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

  const [settings, products, weeklySchedule, zones] = await Promise.all([
    settingsRepository.get(),
    productRepository.findAllForAvailabilityToggle(),
    getWeeklySchedule(),
    // `findAllForAdmin`, no `findAllActive`: una zona apagada tiene que seguir
    // visible acá, si no no hay forma de volver a encenderla.
    communeRepository.findAllForAdmin(),
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

  const since = startOfDay(subDays(new Date(), 6));
  const [sales, dailySeries] = await Promise.all([
    analyticsRepository.salesBetween(since, new Date()),
    analyticsRepository.dailySeries(since, new Date()),
  ]);

  return (
    <main className="min-h-dvh pb-12">
      <header className="border-border bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Admin</h1>
            <p className="text-muted-foreground text-xs">Casa Origen</p>
          </div>
          <div className="flex items-center gap-2">
            {/* La tienda es a dónde vuelve el operador después de tocar algo:
                sin esto había que editar la URL a mano para ver el efecto. */}
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <Store aria-hidden="true" />
                Ver tienda
              </Link>
            </Button>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/*
        Una sola grilla: móvil apila en el orden de siempre (operación, horarios,
        menú, métricas). Desde `lg` se colocan a mano para que la columna angosta
        quede con lo que se toca a diario y la ancha con las tablas.
      */}
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-3 lg:items-start lg:py-8">
        {/* Operations: store status + delivery */}
        <section className="border-border bg-card divide-border divide-y rounded-2xl border lg:col-start-1 lg:row-start-1">
          <div className="space-y-4 p-6">
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

          <div className="space-y-4 p-6">
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

        {/* Business hours */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6 lg:col-span-2 lg:col-start-2 lg:row-start-1">
          <div>
            <p className="text-muted-foreground text-xs tracking-widest uppercase">Horarios</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Estos son los horarios que se muestran en la web. Deja el turno 2 en blanco si ese día
              no cierras al mediodía.
            </p>
          </div>
          <AdminForm action={updateBusinessHoursAction} className="space-y-2">
            {/*
              Cabecera solo desde `lg`: en móvil los inputs se envuelven y los
              rótulos dejarían de caer sobre su columna.
            */}
            <div className="text-muted-foreground/70 hidden grid-cols-[4.5rem_1fr_1fr_6.5rem] items-center gap-3 text-[10px] tracking-widest uppercase lg:grid">
              <span>Día</span>
              <span>Turno 1</span>
              <span>Turno 2</span>
              <span className="px-1">Cerrado</span>
            </div>
            {/*
              Los inputs se renderizan siempre, también en un día cerrado: un día
              sin input no aparece en `formData` y no había forma de abrirlo. La
              casilla «Cerrado» es lo único que decide, y el server la respeta
              aunque las horas vengan cargadas.

              El turno 2 vacío no es un error: es el día sin corte al mediodía.
              El server descarta el turno si le falta una de las dos horas, y no
              cierra el día por eso.
            */}
            {weeklySchedule.map((day) => {
              const first = day.slots[0] ?? FALLBACK_SHIFTS[0];
              // Un día abierto de un solo turno deja el 2 en blanco a propósito:
              // precargarlo le inventaría una franja al guardar.
              const second = day.slots[1] ?? (day.isClosed ? FALLBACK_SHIFTS[1] : EMPTY_SHIFT);

              return (
                <div
                  key={day.dayOfWeek}
                  className="border-border/60 space-y-2 border-t pt-3 lg:grid lg:grid-cols-[4.5rem_1fr_1fr_6.5rem] lg:items-center lg:gap-3 lg:space-y-0 lg:pt-2"
                >
                  <span className="text-muted-foreground text-sm font-medium">{day.label}</span>

                  {[first, second].map((shift, index) => {
                    const shiftNumber = index + 1;

                    return (
                      <div key={shiftNumber} className="min-w-0">
                        {/* Desde `lg` el rótulo lo pone la cabecera de columna. */}
                        <span className="text-muted-foreground/70 mb-1 block text-[10px] tracking-widest uppercase lg:hidden">
                          Turno {shiftNumber}
                        </span>
                        <div className="flex min-w-0 items-center gap-x-2">
                          <Input
                            type="time"
                            name={`${day.dayOfWeek}_${shiftNumber}_opensAt`}
                            defaultValue={shift.opensAt}
                            aria-label={`${day.label}, turno ${shiftNumber}: hora de apertura`}
                            className="h-11 min-w-0 flex-1"
                          />
                          <span className="text-muted-foreground shrink-0" aria-hidden="true">
                            –
                          </span>
                          <Input
                            type="time"
                            name={`${day.dayOfWeek}_${shiftNumber}_closesAt`}
                            defaultValue={shift.closesAt}
                            aria-label={`${day.label}, turno ${shiftNumber}: hora de cierre`}
                            className="h-11 min-w-0 flex-1"
                          />
                        </div>
                      </div>
                    );
                  })}

                  <label className="text-muted-foreground flex h-11 cursor-pointer items-center gap-1.5 px-1 text-sm">
                    <input
                      type="checkbox"
                      name={`${day.dayOfWeek}_closed`}
                      defaultChecked={day.isClosed}
                      className="accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none"
                    />
                    Cerrado
                  </label>
                </div>
              );
            })}
            <AdminSubmit className="h-11 w-full">Guardar horarios</AdminSubmit>
          </AdminForm>
        </section>

        {/* Menu availability */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6 lg:col-span-2 lg:col-start-2 lg:row-start-2">
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
          {[...categories.values()].map(({ categoryName, products: categoryProducts }) => (
            <div key={categoryName} className="space-y-2">
              <p className="text-muted-foreground/70 text-[10px] tracking-widest uppercase">
                {categoryName}
              </p>
              <div className="border-border divide-border bg-background divide-y overflow-hidden rounded-xl border lg:grid lg:grid-cols-2 lg:divide-y-0">
                {categoryProducts.map((product, index) => {
                  const isUnavailable = product.availability === 'OUT_OF_STOCK';
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'border-border flex items-center justify-between gap-3 px-3 py-2',
                        // En dos columnas el `divide-y` del padre no separa filas:
                        // el borde lo pone cada celda salvo la primera de su columna.
                        'lg:border-t',
                        index < 2 && 'lg:border-t-0',
                        index % 2 === 1 && 'lg:border-l',
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

        {/* Delivery zones */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6 lg:col-span-2 lg:col-start-2 lg:row-start-3">
          <div>
            <p className="text-muted-foreground text-xs tracking-widest uppercase">
              Zonas de despacho
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              El cobro es siempre el valor mínimo; el máximo solo se muestra como referencia en la
              web. Los minutos se suman a los {settings.deliveryEtaMinutes} min base.
            </p>
          </div>

          <AdminForm action={updateCommunesAction} className="space-y-2">
            {/* Igual que en horarios: la cabecera solo desde `lg`, porque en
                móvil los inputs se envuelven y los rótulos dejarían de caer
                sobre su columna. */}
            <div className="text-muted-foreground/70 hidden grid-cols-[1fr_22rem] items-center gap-3 text-[10px] tracking-widest uppercase lg:grid">
              <span>Sector</span>
              <div className="flex min-w-0 items-center gap-x-2">
                <span className="min-w-0 flex-1">Mínimo</span>
                <span className="shrink-0 opacity-0" aria-hidden="true">
                  –
                </span>
                <span className="min-w-0 flex-1">Máximo</span>
                <span className="w-16 shrink-0">Min. extra</span>
                <span className="w-[5.5rem] shrink-0 px-1">Activa</span>
              </div>
            </div>

            {zones.map((zone) => (
              <div
                key={zone.id}
                className="border-border/60 grid items-center gap-1 border-t pt-2 lg:grid-cols-[1fr_22rem] lg:gap-3"
              >
                {/* `zoneId` viaja aparte: una casilla sin marcar no aparece en
                    el `FormData`, así que sin esta lista no habría forma de
                    saber que la zona existe para apagarla. */}
                <input type="hidden" name="zoneId" value={zone.id} />
                <span className="text-sm font-medium">{zone.name}</span>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <Input
                    name={`${zone.id}_min`}
                    inputMode="numeric"
                    defaultValue={formatMoney(zone.deliveryFeeMin)}
                    aria-label={`${zone.name}: despacho mínimo`}
                    className="h-11 min-w-0 flex-1"
                  />
                  <span className="text-muted-foreground shrink-0" aria-hidden="true">
                    –
                  </span>
                  <Input
                    name={`${zone.id}_max`}
                    inputMode="numeric"
                    defaultValue={formatMoney(zone.deliveryFeeMax)}
                    aria-label={`${zone.name}: despacho máximo`}
                    className="h-11 min-w-0 flex-1"
                  />
                  <Input
                    name={`${zone.id}_minutes`}
                    inputMode="numeric"
                    defaultValue={String(zone.extraMinutes)}
                    aria-label={`${zone.name}: minutos extra`}
                    className="h-11 w-16 shrink-0"
                  />
                  <label className="text-muted-foreground flex h-11 shrink-0 cursor-pointer items-center gap-1.5 px-1 text-sm lg:w-[5.5rem]">
                    <input
                      type="checkbox"
                      name={`${zone.id}_active`}
                      defaultChecked={zone.isActive}
                      className="accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none"
                    />
                    Activa
                  </label>
                </div>
              </div>
            ))}

            <AdminSubmit className="h-11 w-full">Guardar zonas</AdminSubmit>
          </AdminForm>
        </section>

        {/* Stats */}
        <section className="border-border bg-card space-y-4 rounded-2xl border p-6 lg:col-start-1 lg:row-start-2">
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Últimos 7 días</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard icon={DollarSign} label="Ventas" value={formatMoney(sales.revenue)} />
            <StatCard icon={ShoppingBag} label="Pedidos" value={String(sales.orderCount)} />
            <StatCard
              icon={Receipt}
              label="Ticket prom."
              value={formatMoney(sales.averageTicket)}
            />
          </div>
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
    </main>
  );
}
