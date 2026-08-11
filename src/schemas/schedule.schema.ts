import { z } from 'zod';

const timeFormat = z
  .string()
  .trim()
  .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato inválido (HH:mm).');

/** `HH:mm` a minutos desde medianoche. El formato ya lo validó `timeFormat`. */
function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const businessHoursDayObject = z.object({
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  opensAt: timeFormat.nullable(),
  closesAt: timeFormat.nullable(),
  /** Segundo turno del día (12:30–15:00 y 18:00–22:00). Null = turno único. */
  opensAt2: timeFormat.nullable().default(null),
  closesAt2: timeFormat.nullable().default(null),
});

/**
 * Un día abierto es uno o dos turnos, nunca medio turno.
 *
 * El turno se valida entero acá y no en la UI: esconder el segundo par de
 * inputs no impide postear `closesAt2` sin `opensAt2`. No se soportan turnos
 * que crucen medianoche — el modelo guarda minutos del mismo día, así que un
 * cierre a las 00:30 se leería como "cierra antes de abrir".
 */
export const businessHoursDaySchema = businessHoursDayObject.superRefine((day, ctx) => {
  const { opensAt, closesAt, opensAt2, closesAt2 } = day;

  const invalid = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if ((opensAt === null) !== (closesAt === null)) {
    invalid('closesAt', 'El turno necesita hora de apertura y de cierre.');
    return;
  }

  if ((opensAt2 === null) !== (closesAt2 === null)) {
    invalid('closesAt2', 'El segundo turno necesita hora de apertura y de cierre.');
    return;
  }

  if (opensAt2 !== null && opensAt === null) {
    invalid('opensAt2', 'No puede haber segundo turno sin el primero.');
    return;
  }

  if (opensAt !== null && closesAt !== null && toMinutes(closesAt) <= toMinutes(opensAt)) {
    invalid('closesAt', 'El cierre debe ser posterior a la apertura.');
  }

  if (opensAt2 !== null && closesAt2 !== null) {
    if (toMinutes(closesAt2) <= toMinutes(opensAt2)) {
      invalid('closesAt2', 'El cierre debe ser posterior a la apertura.');
    }

    if (closesAt !== null && toMinutes(opensAt2) < toMinutes(closesAt)) {
      invalid('opensAt2', 'El segundo turno no puede empezar antes de que cierre el primero.');
    }
  }
});

export const businessHoursSchema = z
  .array(businessHoursDaySchema)
  .length(7, 'Debe incluir los 7 días de la semana.');

export type BusinessHoursDayInput = z.infer<typeof businessHoursDaySchema>;
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
