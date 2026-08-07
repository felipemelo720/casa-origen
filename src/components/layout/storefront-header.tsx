'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock, MapPin, Menu, MessageCircle, Phone, Pizza, ShoppingBag, User } from 'lucide-react';

import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useCartCount, useCartStore, useCartSubtotal } from '@/features/cart/cart-store';
import { formatMoney } from '@/lib/money';
import type { OpenState } from '@/server/services/schedule.service';
import { cn } from '@/lib/utils';

/** Every href is an anchor that exists in `(storefront)/page.tsx`. */
const NAV_LINKS = [
  { href: '#menu', label: 'Menú' },
  { href: '#cobertura', label: 'Cobertura' },
  { href: '#como-pedir', label: 'Cómo pedir' },
  { href: '#horarios', label: 'Horarios' },
] as const;

const NAV_IDS = NAV_LINKS.map((link) => link.href.slice(1));

// 60s, not 15s: `/api/open-state` is `force-dynamic`, so every tick is a query
// per open tab. Toggling `acceptingOrders` in /admin already calls
// `revalidatePath('/')`, so a fresh visit is instant either way; this poll only
// covers tabs that were already open. `visibilitychange` and `focus` still
// refresh on the spot, which is when staleness is actually noticed.
const OPEN_STATE_POLL_MS = 60_000;

export type HeaderTodayHours = {
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

type Props = {
  restaurantName: string;
  logo: string | null;
  phone: string | null;
  /** Ready-to-use `wa.me` link, or null when no number is configured. */
  whatsappUrl: string | null;
  address: string | null;
  open: OpenState;
  /** Today's advertised row of `business_hours`; null if the day is missing. */
  todayHours: HeaderTodayHours | null;
};

export function StorefrontHeader({
  restaurantName,
  logo,
  phone,
  whatsappUrl,
  address,
  open: initialOpen,
  todayHours,
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openState, setOpenState] = useState(initialOpen);
  const [mounted, setMounted] = useState(false);

  const openCart = useCartStore((state) => state.open);
  const count = useCartCount();
  const subtotal = useCartSubtotal();

  // The cart lives in localStorage, so its real value only exists after mount.
  useEffect(() => setMounted(true), []);

  // The page is static with `revalidate = 60`, so the server-rendered badge can
  // be a minute behind the switch in /admin. Polling keeps it within seconds
  // without turning the whole landing dynamic.
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/open-state', { cache: 'no-store' });
        if (!response.ok) return;
        const next: OpenState = await response.json();
        if (!cancelled) setOpenState(next);
      } catch {
        // Offline or a dropped request: keep showing the last known state.
      }
    };

    const interval = setInterval(refresh, OPEN_STATE_POLL_MS);
    // A tab left open for hours is stale the moment it comes back.
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Which section the reader is actually in. Cheaper and steadier than doing
  // the math on every scroll event.
  useEffect(() => {
    const targets = NAV_IDS.map((id) => document.getElementById(id)).filter(
      (element): element is HTMLElement => element !== null,
    );
    if (targets.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Document order decides, so overlapping sections resolve to the first.
        setActiveId(NAV_IDS.find((id) => visible.has(id)) ?? null);
      },
      // Only the middle band of the viewport counts as "here".
      { rootMargin: '-30% 0px -55% 0px' },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const cartLabel =
    mounted && count > 0
      ? `Abrir carrito, ${count} ${count === 1 ? 'producto' : 'productos'}, ${formatMoney(subtotal)}`
      : 'Abrir carrito, vacío';

  return (
    <>
      {/* First stop for keyboard and screen-reader users. */}
      <a
        href="#contenido"
        className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-semibold focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3"
      >
        Ir al contenido
      </a>

      <header
        className={cn(
          'bg-background/85 sticky top-0 z-40 w-full backdrop-blur transition-shadow',
          scrolled && 'border-border border-b shadow-sm',
        )}
      >
        {/* Utility bar: hours and contact, the two things people scan for before
            deciding to order. Dropped on phones, where the sheet carries it. */}
        <div className="border-border/60 bg-secondary/50 hidden border-b sm:block">
          <div className="text-muted-foreground mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs sm:px-6 lg:px-8">
            <p className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {todayHours && !todayHours.isClosed ? (
                <span>
                  Hoy atendemos de {todayHours.opensAt} a {todayHours.closesAt}
                </span>
              ) : (
                <span>Hoy sin horario publicado</span>
              )}
            </p>

            <div className="flex items-center gap-4">
              {address && (
                <span className="hidden items-center gap-1.5 lg:flex">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {address}
                </span>
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                  className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {phone}
                </a>
              )}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="size-3.5 shrink-0" aria-hidden />
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5"
            aria-label={`${restaurantName}, ir al inicio`}
          >
            {logo ? (
              // Wordmark PNG is solid white: masked with `currentColor` so it
              // reads on both the light and dark `--foreground` token instead
              // of vanishing on a light background.
              <BrandMark logo={logo} />
            ) : (
              <>
                <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg">
                  <Pizza className="size-5" aria-hidden />
                </span>
                <span className="font-display truncate text-lg font-bold tracking-tight sm:text-xl">
                  {restaurantName}
                </span>
              </>
            )}
          </Link>

          <OpenBadge open={openState} />

          <nav aria-label="Secciones" className="mx-auto hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activeId === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground/80 hover:text-primary hover:bg-secondary',
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {/* A route, not an anchor: the account page reads a session cookie
                and cannot live on the static landing. */}
            <Button variant="ghost" size="icon" asChild>
              <Link href="/cuenta" aria-label="Mi cuenta">
                <User className="size-4" aria-hidden />
              </Link>
            </Button>

            <ThemeToggle />

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={openCart}
              aria-label={cartLabel}
            >
              <ShoppingBag className="size-4" aria-hidden />
              {mounted && count > 0 && (
                <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Button>
            {/* The subtotal, not just a count: it answers "how much am I at?"
                without opening the drawer. */}
            {mounted && count > 0 && (
              <button
                type="button"
                onClick={openCart}
                className="text-foreground hover:bg-secondary hidden rounded-md px-2 py-1 text-sm font-semibold tabular-nums transition-colors lg:block"
              >
                {formatMoney(subtotal)}
              </button>
            )}
            {/* Announced separately so the count change is heard, not just seen. */}
            <span aria-live="polite" className="sr-only">
              {mounted ? `${count} productos en el carrito` : ''}
            </span>

            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
                  <Menu className="size-4" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
                <SheetTitle className="sr-only">Menú de navegación</SheetTitle>

                <div className="border-border space-y-3 border-b p-6">
                  <p className="font-display text-lg font-bold">{restaurantName}</p>
                  <OpenBadge open={openState} />
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    {todayHours && !todayHours.isClosed
                      ? `Hoy ${todayHours.opensAt} – ${todayHours.closesAt}`
                      : 'Hoy sin horario publicado'}
                  </p>
                </div>

                <nav aria-label="Secciones" className="flex flex-col p-3">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      // Without this the sheet stays over the section it just
                      // scrolled to.
                      onClick={() => setNavOpen(false)}
                      className="hover:bg-secondary rounded-md px-3 py-2.5 text-base font-medium transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>

                <Separator />

                <div className="mt-auto space-y-3 p-6 text-sm">
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                    >
                      <Phone className="size-4 shrink-0" aria-hidden />
                      {phone}
                    </a>
                  )}
                  {address && (
                    <p className="text-muted-foreground flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {address}
                    </p>
                  )}
                  {whatsappUrl && (
                    <Button asChild className="w-full">
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4" aria-hidden />
                        Escríbenos por WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}

/**
 * Same `getOpenState()` the checkout enforces, refreshed by the poll above, so
 * the badge cannot say "Abierto" while `placeOrder` refuses.
 */
function OpenBadge({ open }: { open: OpenState }) {
  return (
    <span
      title={open.isOpen ? undefined : open.reason}
      className={cn(
        'flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        open.isOpen ? 'bg-success/15 text-foreground' : 'bg-warning/20 text-foreground',
      )}
    >
      <span
        className={cn('size-1.5 rounded-full', open.isOpen ? 'bg-success' : 'bg-warning')}
        aria-hidden
      />
      {open.isOpen ? 'Abierto' : 'Cerrado'}
    </span>
  );
}
