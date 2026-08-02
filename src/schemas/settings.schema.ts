import { z } from 'zod';

export const settingsSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa un nombre.').max(80),
  tagline: z.string().trim().max(160).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),

  email: z.string().trim().email('Correo inválido.').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  whatsapp: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),

  instagramUrl: z.string().trim().url('URL inválida.').optional().or(z.literal('')),
  facebookUrl: z.string().trim().url('URL inválida.').optional().or(z.literal('')),

  acceptingOrders: z.boolean(),
  closedMessage: z.string().trim().max(200).optional().or(z.literal('')),

  defaultDeliveryFee: z.coerce.number().int().min(0).max(1_000_000),
  freeDeliveryFrom: z.coerce.number().int().min(0).max(10_000_000),
  minOrderAmount: z.coerce.number().int().min(0).max(1_000_000),
  deliveryEtaMinutes: z.coerce.number().int().min(1).max(600),
  pickupEtaMinutes: z.coerce.number().int().min(1).max(600),

  seoTitle: z.string().trim().max(160).optional().or(z.literal('')),
  seoDescription: z.string().trim().max(300).optional().or(z.literal('')),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
