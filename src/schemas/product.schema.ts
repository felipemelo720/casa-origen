import { z } from 'zod';

export const productVariantOptionSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido.').max(60),
  priceDelta: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
});

export const productVariantGroupSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido.').max(60),
  selectionType: z.enum(['SINGLE', 'MULTIPLE']),
  isRequired: z.boolean(),
  minSelect: z.coerce.number().int().min(0).max(20),
  maxSelect: z.coerce.number().int().min(1).max(20),
  options: z.array(productVariantOptionSchema).min(1, 'Agrega al menos una opción.'),
});

export const productExtraLinkSchema = z.object({
  extraId: z.string().min(1),
  priceOverride: z.coerce.number().int().min(0).max(1_000_000).optional(),
  maxQuantity: z.coerce.number().int().min(1).max(20),
});

export const productImageSchema = z.object({
  url: z.string().trim().url('URL inválida.'),
  alt: z.string().trim().max(120).optional(),
});

export const productIngredientLinkSchema = z.object({
  ingredientId: z.string().min(1),
  isRemovable: z.boolean(),
});

export const productBaseSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa un nombre.').max(120),
  slug: z
    .string()
    .trim()
    .min(2, 'Ingresa un slug.')
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones.'),
  shortDescription: z.string().trim().max(160).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Selecciona una categoría.'),

  price: z.coerce.number().int().min(0, 'El precio no puede ser negativo.').max(10_000_000),
  offerPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),

  availability: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'SCHEDULED']),
  prepMinutes: z.coerce.number().int().min(1).max(600),
  allowNotes: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),

  isActive: z.boolean(),
  isVisible: z.boolean(),
  isFeatured: z.boolean(),

  images: z.array(productImageSchema).max(10),
  tagIds: z.array(z.string().min(1)).max(10),
  ingredients: z.array(productIngredientLinkSchema).max(30),
  variantGroups: z.array(productVariantGroupSchema).max(10),
  extras: z.array(productExtraLinkSchema).max(20),
});

function refineOfferPrice<T extends { price: number; offerPrice?: number }>(data: T, ctx: z.RefinementCtx) {
  if (data.offerPrice !== undefined && data.offerPrice >= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['offerPrice'],
      message: 'El precio de oferta debe ser menor al precio normal.',
    });
  }
}

export const productSchema = productBaseSchema.superRefine(refineOfferPrice);

export const productWithIdSchema = productBaseSchema
  .extend({ id: z.string().min(1) })
  .superRefine(refineOfferPrice);

export type ProductInput = z.infer<typeof productSchema>;
export type ProductVariantGroupInput = z.infer<typeof productVariantGroupSchema>;
