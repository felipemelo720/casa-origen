'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { useCartStore } from '@/features/cart/cart-store';
import type { CartDrawerProps } from '@/features/cart/cart-drawer';

/**
 * The drawer is the heaviest client bundle on the landing — it pulls in
 * `CheckoutForm`, react-hook-form, the zod resolver and react-query — and none
 * of it is on screen until someone opens the cart. Importing it eagerly from
 * the layout made every first visit pay for a checkout that most visitors
 * reach later or never.
 */
const loadCartDrawer = () => import('@/features/cart/cart-drawer');

// `ssr: false` because the drawer reads the cart from localStorage anyway:
// there is nothing meaningful to render on the server.
const CartDrawer = dynamic(() => loadCartDrawer().then((module) => module.CartDrawer), {
  ssr: false,
});

export function CartDrawerMount(props: CartDrawerProps) {
  const isOpen = useCartStore((state) => state.isOpen);
  // Latched: once opened, it stays mounted. Unmounting on close would kill the
  // sheet's exit animation and re-fetch the chunk on the next open.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  // Warm the chunk while the browser is idle, so the first tap on the cart
  // opens the sheet instead of waiting on a network round trip. On a slow 4G
  // connection that wait is the whole point of the deferral going wrong.
  useEffect(() => {
    if (mounted) return;

    if (typeof window.requestIdleCallback !== 'function') {
      const timeout = window.setTimeout(() => void loadCartDrawer(), 2000);
      return () => window.clearTimeout(timeout);
    }

    const handle = window.requestIdleCallback(() => void loadCartDrawer(), { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }, [mounted]);

  if (!mounted) return null;

  return <CartDrawer {...props} />;
}
