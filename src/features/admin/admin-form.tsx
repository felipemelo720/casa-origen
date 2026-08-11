'use client';

import { Loader2 } from 'lucide-react';
import { useActionState, useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/result';
import { cn } from '@/lib/utils';

/**
 * Toda acción del panel devuelve el mismo par: qué pasó y cómo se cuenta.
 * `data` es el texto que lee el operador, no un payload: lo único que necesita
 * saber es si quedó guardado.
 */
export type AdminAction = (
  state: ActionResult<string> | null,
  formData: FormData,
) => Promise<ActionResult<string>>;

/**
 * Formulario del panel con estado de envío y resultado.
 *
 * Existe porque el panel entero eran `<form action={serverAction}>` nativos:
 * el operador tocaba «Guardar horarios», la página se revalidaba sin mover
 * nada visible y no había forma de distinguir «guardado» de «se cayó». Con las
 * manos llenas de harina y el local abierto, esa duda se paga apretando el
 * botón otra vez.
 *
 * La frontera cliente llega hasta acá y no más: los hijos siguen siendo
 * server components, se pasan como `children` y no cruzan el bundle.
 */
export function AdminForm({
  action,
  children,
  className,
  feedback = 'inline',
}: {
  action: AdminAction;
  children: ReactNode;
  className?: string;
  /**
   * `inline` agrega una línea de estado bajo el formulario. `toast` la omite:
   * en las filas del menú son botones de ícono dentro de una grilla angosta y
   * un párrafo extra descuadraría la fila entera.
   */
  feedback?: 'inline' | 'toast';
}) {
  const [state, formAction] = useActionState(action, null);

  // `useActionState` entrega un objeto nuevo por cada envío, así que el efecto
  // corre una vez por resultado y no en cada render. El ref cubre el caso del
  // Strict Mode en desarrollo, que monta dos veces.
  const announced = useRef<ActionResult<string> | null>(null);
  useEffect(() => {
    if (!state || announced.current === state) return;
    announced.current = state;
    if (state.ok) toast.success(state.data);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className={className}>
      {children}

      {/*
        El toast desaparece solo y puede perderse si el operador está mirando
        otra parte de la pantalla. La línea se queda hasta el próximo envío, así
        que el estado sigue disponible cuando vuelve la vista.
      */}
      {feedback === 'inline' && state && (
        <p
          role="status"
          aria-live="polite"
          className={cn('text-sm font-medium', state.ok ? 'text-success' : 'text-destructive')}
        >
          {state.ok ? state.data : state.message}
        </p>
      )}
    </form>
  );
}

/**
 * Botón de envío que se apaga y se nombra mientras la acción corre.
 *
 * `useFormStatus` sólo lee el `<form>` que lo contiene, por eso es un
 * componente aparte y no un prop de `AdminForm`.
 */
export function AdminSubmit({
  children,
  pendingLabel = 'Guardando…',
  className,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} {...props}>
      {pending ? (
        <>
          <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
