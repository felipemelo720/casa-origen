import 'server-only';

import { businessHourRepository } from '@/server/repositories/operations.repository';
import type { BusinessHoursDayInput } from '@/schemas/schedule.schema';

/**
 * Convert HH:mm to minutes from midnight.
 */
function timeToMinutes(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  if (hours === undefined || minutes === undefined) return null;
  return hours * 60 + minutes;
}

/**
 * Upsert all 7 business hours at once.
 * Takes HH:mm strings, converts to minutes, updates via businessHourRepository.
 */
export const scheduleRepository = {
  async upsertBusinessHours(days: BusinessHoursDayInput[]) {
    const dayOfWeekMap: Record<string, number> = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    };

    const results = await Promise.all(
      days.map((day) => {
        const dayNum = dayOfWeekMap[day.dayOfWeek] ?? 0;
        const isClosed = !day.opensAt || !day.closesAt;
        const opensAtMinutes = isClosed ? 0 : (timeToMinutes(day.opensAt) ?? 0);
        const closesAtMinutes = isClosed ? 0 : (timeToMinutes(day.closesAt) ?? 0);
        // Un día cerrado no guarda segundo turno: si vuelve a abrir, lo hace con
        // las horas que el operador escriba, no con las que quedaron colgando.
        const secondShift =
          isClosed || !day.opensAt2 || !day.closesAt2
            ? { opensAt2: null, closesAt2: null }
            : {
                opensAt2: timeToMinutes(day.opensAt2),
                closesAt2: timeToMinutes(day.closesAt2),
              };

        return businessHourRepository.upsertDay(dayNum, {
          isClosed,
          opensAt: opensAtMinutes,
          closesAt: closesAtMinutes,
          ...secondShift,
        });
      }),
    );

    return results;
  },
};
