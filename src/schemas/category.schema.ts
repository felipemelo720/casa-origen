import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Ingresa un nombre.').max(80),
  slug: z
    .string()
    .trim()
    .min(2, 'Ingresa un slug.')
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones.'),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  image: z.string().trim().url('URL inválida.').optional().or(z.literal('')),
  icon: z.string().trim().max(50).optional().or(z.literal('')),
  parentId: z.string().min(1).optional().or(z.literal('')),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export type CategoryInput = z.infer<typeof categorySchema>;
