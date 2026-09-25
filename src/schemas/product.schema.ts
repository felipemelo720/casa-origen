import { z } from 'zod';

/**
 * Producto como lo edita el operador en `/admin/productos`.
 *
 * Un solo grupo de variantes (tamaño), no N: la carta real nunca pidió una
 * segunda dimensión (masa, cocción), y modelar grupos arbitrarios habría
 * significado filas dinámicas con estado de cliente. Si aparece esa
 * necesidad, se extiende entonces — hoy sería JS que nadie usa.
 */
export const MAX_VARIANT_OPTIONS = 6;

const optionSchema = z.object({
  /**
   * Id de la opción que se está editando; ausente en una fila nueva. Editar
   * conserva el id: los carritos guardados en `localStorage` referencian la
   * opción por id, y recrearla dejaría esos carritos rechazados en el checkout.
   */
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, 'Nombra la opción.').max(40),
  priceDelta: z.number().int(),
  extraPrice: z.number().int().min(0).nullable(),
  extraPremiumPrice: z.number().int().min(0).nullable(),
  isAvailable: z.boolean(),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Ingresa el nombre.').max(80),
    slug: z
      .string()
      .trim()
      .min(2, 'El slug es muy corto.')
      .max(96)
      .regex(/^[a-z0-9-]+$/, 'El slug va en minúsculas, números y guiones.'),
    categoryId: z.string().min(1, 'Elige una categoría.'),
    shortDescription: z.string().trim().max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    price: z.number().int().min(1, 'El precio debe ser mayor a 0.'),
    offerPrice: z.number().int().min(0).nullable(),
    prepMinutes: z.number().int().min(1).max(180),
    allowNotes: z.boolean(),
    isVisible: z.boolean(),
    variantGroupName: z.string().trim().max(40).optional(),
    options: z.array(optionSchema).max(MAX_VARIANT_OPTIONS),
  })
  .superRefine((product, ctx) => {
    if (product.offerPrice !== null && product.offerPrice >= product.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offerPrice'],
        message: 'La oferta debe ser menor que el precio normal.',
      });
    }
    // Opciones sin rótulo de grupo quedarían huérfanas: no habría qué mostrarle
    // al cliente sobre el selector ("Elige tu Tamaño").
    if (product.options.length > 0 && !product.variantGroupName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variantGroupName'],
        message: 'Nombra el grupo de variantes (ej. "Tamaño").',
      });
    }
  });

export type ProductFormInput = z.infer<typeof productFormSchema>;
export type ProductOptionInput = z.infer<typeof optionSchema>;
