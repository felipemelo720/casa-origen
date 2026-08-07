import { Clock } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * El aviso de "no estamos recibiendo pedidos", con el mismo tono en el hero y
 * arriba del menú. Vive acá porque son dos dominios distintos (storefront y
 * catálogo) mostrando el mismo estado: duplicar el markup fue justo lo que
 * dejó un `amber-500` hardcodeado en dos archivos.
 *
 * `role="status"`: el estado abierto/cerrado se refresca por poll, así que un
 * lector de pantalla tiene que enterarse sin que nadie navegue.
 */
export function ClosedNotice({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <p
      role="status"
      className={cn(
        // El borde sale de `--warning-emphasis`, no de `--warning`: en light,
        // `--warning` a opacidad completa llega a 1.97:1 contra la tarjeta y el
        // bloque no se lee como bloque. A 65% el borde da 3.3:1 en light y
        // 5.6:1 en dark; el texto queda en 7.1:1 y 9.8:1.
        'border-warning-emphasis/65 bg-warning/10 text-warning-emphasis flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
        className,
      )}
    >
      <Clock className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
