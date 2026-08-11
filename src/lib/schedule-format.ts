import type { ScheduleSlot } from '@/server/services/schedule.service';

/**
 * Los turnos de un día, listos para leer: «12:30 – 15:00 y 18:00 – 22:00».
 *
 * Vive acá y no en el servicio porque el header es un componente cliente:
 * `schedule.service.ts` es `server-only` y de ahí solo se puede importar el
 * tipo, que al compilar se borra.
 */
export function formatShifts(slots: readonly ScheduleSlot[]): string {
  return slots.map((slot) => `${slot.opensAt} – ${slot.closesAt}`).join(' y ');
}
