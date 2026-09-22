import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Título de cada sección del panel. La navegación entre secciones la da el
 * layout; `back` es solo para bajar un nivel (lista → ficha de producto).
 */
export function AdminPageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {back && (
          <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
            <Link href={back.href} aria-label={back.label}>
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
        )}
        <div className="min-w-0 space-y-1 pt-1.5">
          <h1 className="font-display truncate text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
