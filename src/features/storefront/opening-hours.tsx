import { CalendarDays } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatShifts } from '@/lib/schedule-format';
import type { OpenState, ScheduleDay } from '@/server/services/schedule.service';

type Props = {
  schedule: ScheduleDay[];
  open: OpenState;
};

/**
 * What the restaurant advertises. `getOpenState` no longer reads it — the
 * switch in /admin decides — so the badge can legitimately disagree with the
 * row for today when the kitchen opens late or stays open past closing.
 */
export function OpeningHours({ schedule, open }: Props) {
  return (
    <div className="border-border bg-card rounded-2xl border p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-primary size-5" />
          <h2 className="font-display text-lg font-semibold">Horarios</h2>
        </div>
        <span
          className={cn(
            // Same tokens as the header badge; no raw palette colors.
            'rounded-full px-3 py-1 text-xs font-semibold',
            open.isOpen ? 'bg-success/15 text-foreground' : 'bg-warning/20 text-foreground',
          )}
        >
          {open.isOpen ? 'Abierto ahora' : 'Cerrado'}
        </span>
      </div>

      <dl className="divide-border divide-y text-sm">
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            // `gap-3`: con los dos turnos la fila llega al borde a 360px y el
            // «hoy» quedaba pegado a la hora.
            className={cn(
              'flex items-baseline justify-between gap-3 py-2',
              day.isToday && 'font-semibold',
            )}
          >
            <dt className={cn(!day.isToday && 'text-muted-foreground')}>
              {day.label}
              {day.isToday && <span className="text-primary ml-2 text-xs">hoy</span>}
            </dt>
            <dd className={cn('text-right', day.isClosed && 'text-muted-foreground')}>
              {day.isClosed ? 'Cerrado' : formatShifts(day.slots)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
