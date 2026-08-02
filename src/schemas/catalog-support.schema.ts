import { z } from 'zod';

export const extraSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa un nombre.').max(60),
  slug: z
    .string()
    .trim()
    .min(2, 'Ingresa un slug.')
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones.'),
  description: z.string().trim().max(200).optional().or(z.literal('')),
  price: z.coerce.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});
export type ExtraInput = z.infer<typeof extraSchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa un nombre.').max(40),
  slug: z
    .string()
    .trim()
    .min(2, 'Ingresa un slug.')
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones.'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hex, ej. #e2725b.'),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});
export type TagInput = z.infer<typeof tagSchema>;

export const ingredientSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa un nombre.').max(60),
  slug: z
    .string()
    .trim()
    .min(2, 'Ingresa un slug.')
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones.'),
  isAllergen: z.boolean(),
  isActive: z.boolean(),
});
export type IngredientInput = z.infer<typeof ingredientSchema>;
