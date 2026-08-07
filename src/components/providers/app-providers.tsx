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
  // Light on arrival, not `system`: an Android phone in dark mode was served the
  // dark palette on the first visit without ever being asked. The toggle still
  // switches to dark and next-themes remembers the choice.
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
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
