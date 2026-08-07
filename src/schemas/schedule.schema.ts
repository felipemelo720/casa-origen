import { z } from 'zod';

const timeFormat = z
  .string()
  .trim()
  .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato inválido (HH:mm).');

export const businessHoursDaySchema = z.object({
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  opensAt: timeFormat.nullable(),
  closesAt: timeFormat.nullable(),
});

export const businessHoursSchema = z
  .array(businessHoursDaySchema)
  .length(7, 'Debe incluir los 7 días de la semana.');

export type BusinessHoursDayInput = z.infer<typeof businessHoursDaySchema>;
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
