import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut, Store } from 'lucide-react';

import { isAdminAuthenticated } from '@/lib/auth/admin-session';
import { logoutAction } from '@/server/actions/admin.actions';
import { AdminNav } from '@/features/admin/admin-nav';
import { Button } from '@/components/ui/button';

/**
 * Marco común de `/admin/*`: barra lateral desde `lg`, barra inferior en el
 * teléfono. Sin sesión no hay marco — `/admin` muestra el login a pantalla
 * completa, y las subrutas ni llegan acá: el middleware las redirige.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdminAuthenticated())) return children;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="border-border bg-card sticky top-0 hidden h-dvh flex-col gap-6 border-r p-4 lg:flex">
        <div className="px-3 pt-2">
          <p className="font-display text-xl font-bold">Admin</p>
          <p className="text-muted-foreground text-xs">Casa Origen</p>
        </div>
        <AdminNav variant="sidebar" />
        <div className="mt-auto space-y-1">
          <SessionActions />
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-12">
        {/* En el teléfono la barra lateral no existe: tienda y salida suben acá. */}
        <header className="border-border flex items-center justify-between gap-2 border-b px-4 py-3 lg:hidden">
          <div>
            <p className="font-display text-lg leading-tight font-bold">Admin</p>
            <p className="text-muted-foreground text-xs">Casa Origen</p>
          </div>
          <div className="flex items-center gap-1">
            <SessionActions compact />
          </div>
        </header>
        <main>{children}</main>
      </div>

      <AdminNav variant="bottom" />
    </div>
  );
}

/** `compact`: solo íconos, para la cabecera del teléfono. */
function SessionActions({ compact = false }: { compact?: boolean }) {
  const size = compact ? 'icon' : 'default';
  const className = compact ? 'size-11' : 'h-11 w-full justify-start';
  return (
    <>
      {/* La tienda es a dónde vuelve el operador después de tocar algo:
          sin esto había que editar la URL a mano para ver el efecto. */}
      <Button asChild variant="ghost" size={size} className={className}>
        <Link href="/" aria-label={compact ? 'Ver tienda' : undefined}>
          <Store aria-hidden="true" />
          {!compact && 'Ver tienda'}
        </Link>
      </Button>
      <form action={logoutAction} className={compact ? undefined : 'w-full'}>
        <Button
          type="submit"
          variant="ghost"
          size={size}
          className={className}
          aria-label={compact ? 'Salir' : undefined}
        >
          <LogOut aria-hidden="true" />
          {!compact && 'Salir'}
        </Button>
      </form>
    </>
  );
}
