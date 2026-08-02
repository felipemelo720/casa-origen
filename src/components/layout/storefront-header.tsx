'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, ShoppingBag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useCartCount, useCartStore } from '@/features/cart/cart-store';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/menu', label: 'Menú' },
  { href: '/pedido', label: 'Mi pedido' },
];

export function StorefrontHeader({ restaurantName }: { restaurantName: string }) {
  const [scrolled, setScrolled] = useState(false);
  const openCart = useCartStore((state) => state.open);
  const count = useCartCount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'bg-background/80 sticky top-0 z-40 w-full backdrop-blur transition-shadow',
        scrolled && 'border-border border-b shadow-sm',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          {restaurantName}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-primary text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="relative" onClick={openCart} aria-label="Abrir carrito">
            <ShoppingBag className="size-4" />
            {mounted && count > 0 && (
              <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <nav className="mt-10 flex flex-col gap-4">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="text-base font-medium">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
