import { z } from 'zod';

import { cartSchema } from '@/schemas/cart.schema';

const chileanPhone = z
  .string()
  .trim()
  .regex(/^\+?56?\s?9\d{8}$|^\+?\d{8,15}$/, 'Ingresa un teléfono válido.');

export const checkoutSchema = z
  .object({
    cart: cartSchema,
    orderType: z.enum(['DELIVERY', 'PICKUP']),

    firstName: z.string().trim().min(2, 'Ingresa tu nombre.').max(60),
    lastName: z.string().trim().min(2, 'Ingresa tu apellido.').max(60),
    phone: chileanPhone,
    email: z.string().trim().email('Ingresa un correo válido.').optional().or(z.literal('')),

    street: z.string().trim().max(160).optional(),
    reference: z.string().trim().max(160).optional(),
    communeId: z.string().min(1).optional(),

    notes: z.string().trim().max(300).optional(),

    paymentMethodId: z.string().min(1, 'Selecciona un método de pago.'),
    cashGiven: z.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === 'DELIVERY') {
      if (!data.street || data.street.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['street'],
          message: 'Ingresa tu dirección.',
        });
      }
      if (!data.communeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['communeId'],
          message: 'Selecciona tu comuna.',
        });
      }
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
