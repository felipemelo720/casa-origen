import {
  Bike,
  Clock,
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  Pizza,
  Store,
} from 'lucide-react';

import Link from 'next/link';

import { BrandMark } from '@/components/layout/brand-mark';
import type { ScheduleDay } from '@/server/services/schedule.service';
import { cn } from '@/lib/utils';

/**
 * Absolute, not a bare `#menu`: the footer renders on every `(storefront)`
 * page, and these sections only exist on `/`. From `/cuenta` a bare hash
 * resolves to `/cuenta#menu`, an id that is not there, and the click does
 * nothing. This is a server component, so it cannot branch on `usePathname()`
 * the way the header does — `/#…` is correct from both pages.
 */
const FOOTER_LINKS = [
  { href: '/#menu', label: 'Nuestras pizzas' },
  { href: '/#cobertura', label: 'Zonas de despacho' },
  { href: '/#como-pedir', label: 'Cómo pedir' },
  { href: '/#horarios', label: 'Horarios' },
] as const;

type Props = {
  restaurantName: string;
  tagline: string | null;
  logo: string | null;
  phone: string | null;
  email: string | null;
  /** Ready-to-use `wa.me` link, or null when no number is configured. */
  whatsappUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  schedule: ScheduleDay[];
  deliveryEnabled: boolean;
  deliveryEtaMinutes: number;
  pickupEtaMinutes: number;
};

/**
 * Server component: the whole footer is data the server already has, so it
 * costs zero client JS. The open/closed badge deliberately lives only in the
 * header — with `revalidate = 60` a second copy down here would be stale
 * without anything refreshing it.
 */
export function StorefrontFooter({
  restaurantName,
  tagline,
  logo,
  phone,
  email,
  whatsappUrl,
  instagramUrl,
  facebookUrl,
  schedule,
  deliveryEnabled,
  deliveryEtaMinutes,
  pickupEtaMinutes,
}: Props) {
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;

  return (
    <footer className="border-border bg-secondary/40 mt-24 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            {logo ? (
              <>
                <BrandMark logo={logo} />
                <p className="sr-only">{restaurantName}</p>
              </>
            ) : (
              <>
                <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-lg">
                  <Pizza className="size-5" aria-hidden />
                </span>
                <p className="font-display text-lg font-bold">{restaurantName}</p>
              </>
            )}
          </div>

          <p className="text-muted-foreground text-sm">
            {tagline ?? 'Cocina de origen, sabor de siempre.'}
          </p>

          <ul className="text-muted-foreground space-y-1.5 text-sm">
            {deliveryEnabled && (
              <li className="flex items-center gap-2">
                <Bike className="size-4 shrink-0" aria-hidden />
                Despacho en {deliveryEtaMinutes} min aprox.
              </li>
            )}
            <li className="flex items-center gap-2">
              <Store className="size-4 shrink-0" aria-hidden />
              Retiro en tienda en {pickupEtaMinutes} min aprox.
            </li>
          </ul>

          {(instagramUrl ?? facebookUrl) && (
            <div className="flex gap-2 pt-1">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${restaurantName} en Instagram`}
                  className="border-border text-muted-foreground hover:text-primary hover:border-primary/40 grid size-9 place-items-center rounded-full border transition-colors"
                >
                  <Instagram className="size-4" aria-hidden />
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${restaurantName} en Facebook`}
                  className="border-border text-muted-foreground hover:text-primary hover:border-primary/40 grid size-9 place-items-center rounded-full border transition-colors"
                >
                  <Facebook className="size-4" aria-hidden />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Contacto</h2>
          <ul className="text-muted-foreground space-y-2.5 text-sm">
            {telHref && phone && (
              <li>
                <a href={telHref} className="hover:text-primary flex items-center gap-2">
                  <Phone className="size-4 shrink-0" aria-hidden />
                  {phone}
                </a>
              </li>
            )}
            {whatsappUrl && (
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary flex items-center gap-2"
                >
                  <MessageCircle className="size-4 shrink-0" aria-hidden />
                  Pedidos por WhatsApp
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="hover:text-primary flex items-center gap-2">
                  <Mail className="size-4 shrink-0" aria-hidden />
                  {email}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Explora</h2>
          <ul className="text-muted-foreground space-y-2.5 text-sm">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 shrink-0" aria-hidden />
            Horarios
          </h2>
          {/* Same rows as the `#horarios` section: what the store advertises.
              The switch in /admin is what actually gates orders. */}
          <dl className="text-muted-foreground space-y-1.5 text-sm">
            {schedule.map((day) => (
              <div
                key={day.dayOfWeek}
                className={cn(
                  'flex items-baseline justify-between gap-3',
                  day.isToday && 'text-foreground font-semibold',
                )}
              >
                <dt>{day.label}</dt>
                <dd className="tabular-nums">
                  {day.isClosed ? 'Cerrado' : `${day.opensAt} – ${day.closesAt}`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {restaurantName}. Todos los derechos reservados.
          </p>
          <p>Paine, Región Metropolitana</p>
        </div>
      </div>
    </footer>
  );
}
