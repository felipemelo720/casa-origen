import { CalendarClock, MessageCircle, Phone, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';

/**
 * A group order is not a cart. Quantities, timing and price all get negotiated,
 * so this section deliberately does not try to be a checkout: it hands the
 * conversation to the operator with the context already typed in.
 */
const EVENT_MIN_PIZZAS = 5;

type Props = {
  /** Used in the prefilled message so the operator sees who is being asked. */
  restaurantName: string;
  whatsapp: string | null;
  phone: string | null;
};

export function EventOrders({ restaurantName, whatsapp, phone }: Props) {
  // No number, no conversation: rendering a section whose only action is dead
  // would be worse than not having it.
  if (!whatsapp && !phone) return null;

  const message =
    `Hola ${restaurantName}, quiero cotizar pizzas para un evento. ` +
    'Somos ___ personas, el día ___ a las ___ hrs.';

  const action = whatsapp
    ? {
        href: buildWhatsAppUrl(whatsapp, message),
        label: 'Cotizar por WhatsApp',
        icon: MessageCircle,
        external: true,
      }
    : { href: `tel:${phone}`, label: `Llamar al ${phone}`, icon: Phone, external: false };

  const points = [
    {
      icon: Users,
      title: `Desde ${EVENT_MIN_PIZZAS} pizzas`,
      body: 'Cumpleaños, oficina, juntas. Te ayudamos a calcular cuántas necesitas.',
    },
    {
      icon: CalendarClock,
      title: 'Avísanos con un día',
      body: 'Con anticipación reservamos el horno y llegamos a la hora que nos digas.',
    },
  ];

  return (
    // Sin `pt`: el menú de arriba ya cierra con `py-16` y sumar otro daba
    // ~128px de vacío entre la carta y esta tarjeta. El `pb` sí hace falta,
    // porque abajo empieza la banda de «Cómo pedir» y la tarjeta la tocaba.
    <section id="eventos" className="mx-auto max-w-5xl scroll-mt-28 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="border-border bg-card rounded-2xl border p-6 sm:p-8 lg:p-10">
        {/* Dos columnas desde `lg`: con una sola, el texto corto dejaba la
            tarjeta medio vacía y el CTA colgando en el aire. */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="text-primary text-xs font-semibold tracking-widest uppercase">
              Pedidos grandes
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-balance sm:text-3xl">
              ¿Tienes un evento?
            </h2>
            <p className="text-muted-foreground mt-3 max-w-prose text-sm leading-relaxed">
              Para pedidos grandes armamos el precio contigo por mensaje, no por el carrito. Nos
              cuentas cuántos son y para cuándo, y te confirmamos el total.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {points.map((point) => (
              <li
                key={point.title}
                className="border-border/60 bg-background flex gap-3 rounded-xl border p-4"
              >
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                  <point.icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{point.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* El CTA cierra la tarjeta a ancho completo en vez de quedar dentro de
            una columna: es la única acción y no compite con nada. */}
        <div className="border-border/60 mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Te respondemos con el total y la hora de entrega.
          </p>
          <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
            <a
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noopener noreferrer' : undefined}
            >
              <action.icon aria-hidden="true" />
              {action.label}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
