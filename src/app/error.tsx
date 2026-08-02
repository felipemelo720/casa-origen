'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="text-destructive size-10" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Ocurrió un error inesperado. Puedes intentar nuevamente.
        </p>
      </div>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
