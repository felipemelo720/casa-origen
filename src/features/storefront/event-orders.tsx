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
    <section id="eventos" className="mx-auto max-w-3xl scroll-mt-28 px-4 pt-16 sm:px-6 lg:px-8">
      <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">¿Tienes un evento?</h2>
        <p className="text-muted-foreground mt-2 max-w-prose text-sm">
          Para pedidos grandes armamos el precio contigo por mensaje, no por el carrito.
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {points.map((point) => (
            <li key={point.title} className="flex gap-3">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                <point.icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">{point.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button asChild size="lg" className="mt-6 min-h-11 w-full sm:w-auto">
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
    </section>
  );
}
