import { z } from 'zod';

/**
 * One delivery zone as the admin edits it. Only the fields the operator has a
 * reason to change from the phone: the band, the extra minutes and whether the
 * zone is served at all. Name and slug stay in the seed — renaming a zone from
 * the panel would desync it from the copy that references it.
 */
const zoneSchema = z
  .object({
    id: z.string().min(1),
    deliveryFeeMin: z.number().int().min(0),
    deliveryFeeMax: z.number().int().min(0),
    extraMinutes: z.number().int().min(0).max(240),
    isActive: z.boolean(),
  })
  // Checked here rather than trusted from the form: an inverted band would let
  // the storefront advertise a ceiling under the fee it charges.
  .refine((zone) => zone.deliveryFeeMax >= zone.deliveryFeeMin, {
    message: 'El valor máximo no puede ser menor que el mínimo.',
    path: ['deliveryFeeMax'],
  });

export const updateCommunesSchema = z.array(zoneSchema).min(1);

export type CommuneZoneInput = z.infer<typeof zoneSchema>;
