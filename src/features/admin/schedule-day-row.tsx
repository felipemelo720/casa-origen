'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ShiftValue = { opensAt: string; closesAt: string };

/**
 * Turno partido real del local. Se precarga al *agregar* el segundo turno, no
 * al pintar la fila: precargarlo siempre le inventaría una franja a un día de
 * turno único al guardar.
 */
const SECOND_SHIFT_DEFAULT: ShiftValue = { opensAt: '18:00', closesAt: '22:00' };

/**
 * Un día de la semana en el panel, pensado para 360px.
 *
 * Antes cada día apilaba cuatro filas (día, turno 1, turno 2 vacío, «Cerrado»)
 * y la sección medía 1779px: corregir el viernes exigía scrollear la semana
 * entera. Además el turno 2 mostraba `--:-- --` en seis de siete días —ruido
 * puro— y un día cerrado seguía mostrando horas cargadas, así que se leía
 * abierto.
 *
 * Acá el día es una tarjeta: «Cerrado» sube a la línea del nombre y el segundo
 * turno solo existe si el día lo tiene. Es cliente porque agregar y quitar el
 * segundo turno es estado real; la frontera termina en la fila y el resto de
 * la sección sigue siendo server component.
 */
export function ScheduleDayRow({
  dayOfWeek,
  label,
  isToday,
  isClosed,
  first,
  second,
}: {
  /** 0 = domingo … 6 = sábado. Es lo que la action espera en el `name`. */
  dayOfWeek: number;
  label: string;
  isToday: boolean;
  isClosed: boolean;
  first: ShiftValue;
  second: ShiftValue;
}) {
  const [closed, setClosed] = useState(isClosed);
  // `null` es «este día no tiene segundo turno». Desmontarlo es seguro: la
  // action arma el turno desde los campos del form, y sin campos no hay turno.
  const [secondShift, setSecondShift] = useState<ShiftValue | null>(
    second.opensAt && second.closesAt ? second : null,
  );

  return (
    <div
      className={cn(
        // `p-2.5` en móvil no es tacañería: cada píxel de padding se lo saca al
        // input de hora, que con un navegador en inglés tiene que entrar
        // «12:30 PM» más el ícono del selector.
        'min-w-0 space-y-2 rounded-xl border p-2.5 sm:p-3',
        closed ? 'border-border/60 border-dashed' : 'border-border',
        isToday && !closed && 'border-primary/40',
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{label}</span>
          {isToday && (
            <span className="text-primary shrink-0 text-[10px] tracking-widest uppercase">hoy</span>
          )}
        </span>

        {/*
          La casilla manda sobre las horas: sin marcar no se envía, y esa
          ausencia es lo que abre el día. Sube a esta línea porque es la
          decisión que más se toca y era la cuarta fila de la tarjeta.
        */}
        <label className="text-muted-foreground -my-2 flex h-11 shrink-0 cursor-pointer items-center gap-1.5 px-1 text-sm">
          <input
            type="checkbox"
            name={`${dayOfWeek}_closed`}
            checked={closed}
            onChange={(event) => setClosed(event.target.checked)}
            className="accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none"
          />
          Cerrado
        </label>
      </div>

      {/*
        Los inputs del turno 1 se renderizan siempre, también en un día
        cerrado: se apagan, no se desmontan. Un día sin input no vuelve nunca a
        formData y no habría forma de reabrirlo.
      */}
      <ShiftFields
        dayOfWeek={dayOfWeek}
        dayLabel={label}
        shiftNumber={1}
        value={first}
        disabled={closed}
      />

      {secondShift === null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={closed}
          onClick={() => setSecondShift(SECOND_SHIFT_DEFAULT)}
          className="text-muted-foreground h-11 w-full justify-start px-2"
        >
          <Plus aria-hidden="true" />
          Segundo turno
        </Button>
      ) : (
        <div className="flex min-w-0 items-center gap-1">
          <ShiftFields
            dayOfWeek={dayOfWeek}
            dayLabel={label}
            shiftNumber={2}
            value={secondShift}
            disabled={closed}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={closed}
            onClick={() => setSecondShift(null)}
            aria-label={`Quitar el segundo turno del ${label.toLowerCase()}`}
            className="text-muted-foreground size-11 shrink-0"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {closed && <p className="text-muted-foreground text-xs">Este día no se publica en la web.</p>}
    </div>
  );
}

/**
 * Par apertura–cierre de un turno.
 *
 * `grid-cols-[1fr_auto_1fr]` en vez de flex: las dos horas quedan del mismo
 * ancho exacto aunque el navegador del operador muestre AM/PM (que es lo que
 * infla el `min-content` del input a ~140px).
 */
function ShiftFields({
  dayOfWeek,
  dayLabel,
  shiftNumber,
  value,
  disabled,
  className,
}: {
  dayOfWeek: number;
  dayLabel: string;
  shiftNumber: 1 | 2;
  value: ShiftValue;
  disabled: boolean;
  className?: string;
}) {
  return (
    <div className={cn('grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1', className)}>
      <Input
        type="time"
        name={`${dayOfWeek}_${shiftNumber}_opensAt`}
        defaultValue={value.opensAt}
        disabled={disabled}
        aria-label={`${dayLabel}, turno ${shiftNumber}: hora de apertura`}
        className="h-11 min-w-0 px-2"
      />
      <span className="text-muted-foreground shrink-0" aria-hidden="true">
        –
      </span>
      <Input
        type="time"
        name={`${dayOfWeek}_${shiftNumber}_closesAt`}
        defaultValue={value.closesAt}
        disabled={disabled}
        aria-label={`${dayLabel}, turno ${shiftNumber}: hora de cierre`}
        className="h-11 min-w-0 px-2"
      />
    </div>
  );
}
