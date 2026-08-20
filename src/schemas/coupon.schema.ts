import { z } from 'zod';

/**
 * Un cupón como lo crea el operador desde `/admin`.
 *
 * Los montos llegan ya parseados a entero por la action (`parseMoney`), igual
 * que en `commune.schema.ts`: acá se valida el número, no el texto.
 *
 * Sólo `PERCENTAGE` y `FIXED`. `BUNDLE_PRICE` existe en el enum de Prisma pero
 * es de las promociones —precio de paquete sobre N unidades de un tamaño—, no
 * de un código que se escribe en el checkout.
 */
export const couponDiscountTypes = ['PERCENTAGE', 'FIXED'] as const;

/** Sin espacios: es un código que alguien va a dictar por teléfono. */
const codePattern = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(codePattern, 'El código va sin espacios: letras, números o guiones (3 a 40).'),
    description: z.string().trim().max(120).optional(),
    discountType: z.enum(couponDiscountTypes),
    value: z.number().int().min(0),
    minSubtotal: z.number().int().min(0),
    maxDiscount: z.number().int().min(1).nullable(),
    usageLimit: z.number().int().min(1).nullable(),
    perCustomerLimit: z.number().int().min(1).max(99),
    freeDelivery: z.boolean(),
    isActive: z.boolean(),
    isPublic: z.boolean(),
    endsAt: z.date().nullable(),
  })
  .superRefine((coupon, ctx) => {
    if (coupon.discountType === 'PERCENTAGE') {
      if (coupon.value < 1 || coupon.value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Un porcentaje va entre 1 y 100.',
        });
      }
    } else {
      // Un `FIXED` de $0 sin envío gratis es exactamente el cupón que rompía el
      // motor: válido, aceptado y sin efecto. `pricing.service` ahora lo
      // rechaza al cotizar; que ni siquiera se pueda crear es más barato.
      if (coupon.value === 0 && !coupon.freeDelivery) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Un cupón de $0 sin envío gratis no descuenta nada.',
        });
      }
      if (coupon.maxDiscount !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxDiscount'],
          message: 'El tope sólo aplica a cupones en porcentaje.',
        });
      }
    }

    // Fail closed: un cupón que nace vencido no avisa de nada, sólo aparece en
    // la lista como si sirviera.
    if (coupon.endsAt !== null && coupon.endsAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'La fecha de término ya pasó.',
      });
    }
  });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
