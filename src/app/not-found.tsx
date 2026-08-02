import Link from 'next/link';
import { CompassIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <CompassIcon className="text-muted-foreground size-10" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          El contenido que buscas no existe o fue movido.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
