'use client';

import type { ReactNode } from 'react';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

/**
 * Deliberately without `QueryProvider`: react-query has exactly one consumer,
 * `CheckoutForm`, so it now sits next to it in `CartDrawer` instead of loading
 * on every route — /admin and /cuenta never query anything from the client.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // Dark on arrival, not `system`: the palette is chosen deliberately instead of
  // inherited from the phone. The toggle still switches to light and next-themes
  // remembers the choice.
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
