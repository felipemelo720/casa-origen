'use client';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useCartStore } from '@/features/cart/cart-store';

/**
 * La única frontera cliente del banner: aplica el código al carrito
 * (`setCoupon`, mismo mecanismo que `checkout-form.tsx`) y lo copia al
 * portapapeles para quien todavía no arma el carrito y quiere guardarlo. El
 * cupón se sigue validando server-side en `priceCart` al cotizar — esto sólo
 * ahorra tipearlo.
 */
export function ApplyCouponButton({ code }: { code: string }) {
  async function handleClick() {
    useCartStore.getState().setCoupon(code);
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Cupón ${code} aplicado y copiado.`);
    } catch {
      // El portapapeles puede fallar (permiso, contexto no seguro); el cupón
      // ya quedó aplicado igual, que es lo que importa.
      toast.success(`Cupón ${code} aplicado.`);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      className="h-9 shrink-0"
    >
      Aplicar
    </Button>
  );
}
