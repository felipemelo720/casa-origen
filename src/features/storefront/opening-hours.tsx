import { CalendarDays } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { OpenState, ScheduleDay } from '@/server/services/schedule.service';

type Props = {
  schedule: ScheduleDay[];
  open: OpenState;
};

/**
 * The weekly schedule already drives `getOpenState`; showing it answers the
 * most asked question without anyone having to message to find out.
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
            'rounded-full px-3 py-1 text-xs font-semibold',
            open.isOpen
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
          )}
        >
          {open.isOpen ? 'Abierto ahora' : 'Cerrado'}
        </span>
      </div>

      <dl className="divide-border divide-y text-sm">
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={cn(
              'flex items-center justify-between py-2',
              day.isToday && 'font-semibold',
            )}
          >
            <dt className={cn(!day.isToday && 'text-muted-foreground')}>
              {day.label}
              {day.isToday && <span className="text-primary ml-2 text-xs">hoy</span>}
            </dt>
            <dd className={cn(day.isClosed && 'text-muted-foreground')}>
              {day.isClosed ? 'Cerrado' : `${day.opensAt} – ${day.closesAt}`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
