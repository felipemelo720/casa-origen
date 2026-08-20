import { z } from 'zod';

/**
 * Cart contract shared by the client store, the checkout form and the
 * pricing engine.
 *
 * The client only ever sends *selections* (ids + quantities); every price is
 * recomputed server-side from the catalogue, so a tampered `localStorage`
 * payload can never change what a customer is charged.
 */
/**
 * Topes del carrito. Viven acá, exportados, porque el store del cliente los
 * necesita para frenar *antes* de armar una línea que este mismo schema iba a
 * rechazar recién en el checkout.
 */
export const MAX_LINE_QUANTITY = 50;
export const MAX_CART_LINES = 60;
export const MAX_EXTRA_QUANTITY = 20;

export const cartItemSchema = z.object({
  cartItemId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  selectedVariantOptionIds: z.array(z.string().min(1)).max(20),
  selectedExtras: z
    .array(
      z.object({
        extraId: z.string().min(1),
        quantity: z.number().int().min(1).max(MAX_EXTRA_QUANTITY),
      }),
    )
    .max(20),
  removedIngredientIds: z.array(z.string().min(1)).max(20),
  notes: z.string().max(300).optional(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'El carrito está vacío.').max(MAX_CART_LINES),
  couponCode: z.string().trim().max(40).optional(),
});

export type CartInput = z.infer<typeof cartSchema>;
