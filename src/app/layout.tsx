import type { Metadata, Viewport } from 'next';
import { Playfair_Display } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import { AppProviders } from '@/components/providers/app-providers';
import { ServiceWorkerRegister } from '@/components/layout/service-worker-register';
import { publicEnv } from '@/config/public-env';
import { cn } from '@/lib/utils';

import './globals.css';

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${publicEnv.NEXT_PUBLIC_APP_NAME} — Cocina de origen, delivery en línea`,
    template: `%s — ${publicEnv.NEXT_PUBLIC_APP_NAME}`,
  },
  description: 'Pide en línea platos de cocina chilena contemporánea. Delivery y retiro en tienda.',
  applicationName: publicEnv.NEXT_PUBLIC_APP_NAME,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-512.svg',
    apple: '/icons/icon-192.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: publicEnv.NEXT_PUBLIC_APP_NAME,
  },
  formatDetection: { telephone: true, email: false, address: false },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: publicEnv.NEXT_PUBLIC_LOCALE.replace('-', '_'),
    siteName: publicEnv.NEXT_PUBLIC_APP_NAME,
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcfb' },
    { media: '(prefers-color-scheme: dark)', color: '#211d18' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={publicEnv.NEXT_PUBLIC_LOCALE.split('-')[0]} suppressHydrationWarning>
      <body
        className={cn(
          GeistSans.variable,
          GeistMono.variable,
          playfairDisplay.variable,
          'min-h-dvh',
        )}
        suppressHydrationWarning
      >
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
