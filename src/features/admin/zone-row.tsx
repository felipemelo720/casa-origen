import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Una zona de despacho en el panel, pensada para 360px.
 *
 * Antes los tres montos y la casilla vivían en un solo `flex-wrap` con la
 * cabecera de rótulos oculta bajo `lg`: en el teléfono el operador veía tres
 * cajas numéricas sin etiqueta y tenía que deducir cuál era el mínimo, cuál el
 * máximo y cuál los minutos. En móvil los campos se acomodan en dos filas de
 * dos con su rótulo encima; desde `lg` vuelven a la fila única de siempre y
 * los rótulos los pone la cabecera de columna.
 *
 * Server component a propósito: el estado apagado se pinta con
 * `has-[…]:` sobre la casilla, sin JS. Lo único que hace falta es que el
 * contenedor sea el que lleva la variante.
 */
export function ZoneRow({
  id,
  name,
  deliveryFeeMin,
  deliveryFeeMax,
  extraMinutes,
  isActive,
}: {
  id: string;
  name: string;
  deliveryFeeMin: number;
  deliveryFeeMax: number;
  extraMinutes: number;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-2 rounded-xl border p-2.5 sm:p-3',
        // Zona apagada: borde punteado y nombre atenuado. Los inputs **no** se
        // deshabilitan (ver el comentario del bloque de campos).
        'has-[input[type=checkbox]:not(:checked)]:border-border/60 has-[input[type=checkbox]:not(:checked)]:border-dashed',
        'border-border lg:grid-cols-[1fr_22rem] lg:items-center lg:gap-3 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:p-0 lg:pt-2',
      )}
    >
      {/* `zoneId` viaja aparte: una casilla sin marcar no aparece en el
          `FormData`, así que sin esta lista no habría forma de saber que la
          zona existe para apagarla. */}
      <input type="hidden" name="zoneId" value={id} />

      <span className="min-w-0 truncate text-sm font-medium">{name}</span>

      {/*
        Los inputs quedan siempre habilitados, también en una zona apagada. La
        action hace `parseMoney(formData.get(...) ?? '')` y `parseMoney('')` es
        `0`: un campo deshabilitado no viaja y la zona se guardaría con
        despacho $0. Acá «apagado» es color, nunca ausencia de dato.

        Móvil: dos filas de dos. Desde `lg`, la fila única de siempre.
      */}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:min-w-0 lg:items-center lg:gap-x-2">
        <Field label="Mínimo" className="lg:min-w-0 lg:flex-1">
          <MoneyInput
            name={`${id}_min`}
            defaultValue={formatMoney(deliveryFeeMin)}
            aria-label={`${name}: despacho mínimo`}
          />
        </Field>

        {/* El guion solo tiene sentido con los dos montos en la misma línea. */}
        <span className="text-muted-foreground hidden shrink-0 lg:block" aria-hidden="true">
          –
        </span>

        <Field label="Máximo" className="lg:min-w-0 lg:flex-1">
          <MoneyInput
            name={`${id}_max`}
            defaultValue={formatMoney(deliveryFeeMax)}
            aria-label={`${name}: despacho máximo`}
          />
        </Field>

        <Field label="Min. extra" className="lg:w-16 lg:shrink-0">
          <div className="relative">
            <Input
              name={`${id}_minutes`}
              inputMode="numeric"
              defaultValue={String(extraMinutes)}
              aria-label={`${name}: minutos extra`}
              className="h-11 w-full pr-9 lg:pr-3"
            />
            {/* Un `25` al lado de un `$12.000` no dice en qué unidad está. */}
            <span
              className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs lg:hidden"
              aria-hidden="true"
            >
              min
            </span>
          </div>
        </Field>

        <label className="text-muted-foreground flex h-11 cursor-pointer items-center gap-1.5 self-end px-1 text-sm lg:w-[5.5rem] lg:shrink-0 lg:self-auto">
          <input
            type="checkbox"
            name={`${id}_active`}
            defaultChecked={isActive}
            className="accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none"
          />
          Activa
        </label>
      </div>
    </div>
  );
}

/** Campo con rótulo propio en móvil; desde `lg` lo pone la cabecera. */
function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="text-muted-foreground/70 mb-1 block text-[10px] tracking-widest uppercase lg:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Monto en pesos. Sin prefijo `$` propio: `formatMoney` ya lo trae en el valor
 * (`$12.990`), y `parseMoney` descarta todo lo que no sea dígito al volver.
 */
function MoneyInput({
  name,
  defaultValue,
  'aria-label': ariaLabel,
}: {
  name: string;
  defaultValue: string;
  'aria-label': string;
}) {
  return (
    <Input
      name={name}
      inputMode="numeric"
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      className="h-11 w-full"
    />
  );
}
