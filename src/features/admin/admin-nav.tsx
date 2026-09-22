'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Pizza, Settings, TicketPercent, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin', label: 'Hoy', icon: LayoutDashboard },
  { href: '/admin/productos', label: 'Productos', icon: Pizza },
  { href: '/admin/cupones', label: 'Cupones', icon: TicketPercent },
  { href: '/admin/configuracion', label: 'Ajustes', icon: Settings },
];

/** `/admin` es prefijo de todo: solo cuenta como activo si es exacto. */
function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === href : pathname.startsWith(href);
}

/**
 * Cliente solo por `usePathname` (marcar la sección activa). Dos formas del
 * mismo menú: barra lateral desde `lg` y barra inferior en el teléfono, en la
 * zona del pulgar — el operador la usa con una mano.
 */
export function AdminNav({ variant }: { variant: 'sidebar' | 'bottom' }) {
  const pathname = usePathname();

  if (variant === 'sidebar') {
    return (
      <nav aria-label="Secciones del panel" className="space-y-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Secciones del panel"
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
