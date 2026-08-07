import type { NextConfig } from 'next';

/**
 * Content-Security-Policy.
 *
 * `script-src` needs `unsafe-inline`: Next.js injects inline `<script>` tags
 * on every page (not just dev) to stream RSC payloads to the client
 * (`(self.__next_f=...).push(...)`), with no nonce attached. Without
 * `unsafe-inline` the browser blocks them, the client never hydrates, and
 * every client component silently stays uninitialized (e.g. `framer-motion`'s
 * `whileInView` never fires, so the menu cards render stuck at `opacity: 0`).
 * A nonce would fix this properly but forces every response to be dynamic —
 * the landing must stay static (`revalidate = 60`) — so this is the accepted
 * trade-off until that's revisited.
 *
 * `style-src` needs `unsafe-inline`: Tailwind and Radix UI inject styles via
 * the `style` attribute at runtime, same nonce-vs-static trade-off.
 *
 * `script-src` needs `unsafe-eval` in dev only: Next's Fast Refresh runtime
 * calls `eval`. Production never gets `unsafe-eval`.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://images.unsplash.com https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

/** Security headers applied to every response. */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: CSP },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  logging: {
    fetches: { fullUrl: false },
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', '@radix-ui/react-icons'],
  },

  serverExternalPackages: ['pino', 'pino-pretty'],

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Solo assets propios: `public/` y el blob store al que sube el admin.
    // `images.unsplash.com` salió de la lista a propósito — una foto de un
    // tercero se cae sin aviso y un 404 de imagen es `Runtime Error:
    // [object Event]` sin stack. Si vuelve a aparecer una URL de Unsplash en
    // la DB, `next/image` la rechaza acá en vez de romper la página en vivo.
    remotePatterns: [{ protocol: 'https', hostname: '**.public.blob.vercel-storage.com' }],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
