'use client';

import type { ReactNode } from 'react';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
