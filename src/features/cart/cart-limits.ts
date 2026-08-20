import { toast } from 'sonner';

import { MAX_CART_LINES } from '@/schemas/cart.schema';

/**
 * Aviso único para el tope de líneas del carrito.
 *
 * Vive acá porque lo disparan tres lugares (grilla, ficha y las promos) y el
 * texto tiene que ser el mismo: el tope es del server, no de cada pantalla.
 */
export function notifyCartFull(): void {
  toast.error('El carrito está lleno', {
    description: `Máximo ${MAX_CART_LINES} productos distintos. Confirma este pedido o quita algo para seguir.`,
  });
}
