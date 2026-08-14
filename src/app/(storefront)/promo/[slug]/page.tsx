import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { ClosedNotice } from '@/components/shared/closed-notice';
import { ProductCard } from '@/features/catalog/product-card';
import { promoPath } from '@/features/catalog/product-path';
import { toProductView } from '@/features/catalog/product-view';
import { DuoPromoCard } from '@/features/promo/duo-promo-card';
import { buildDuoPromoView } from '@/features/promo/duo-promo-view';
import { publicEnv } from '@/config/public-env';
import { currencyCode, currencyDecimals, formatMoney } from '@/lib/money';
import { productRepository } from '@/server/repositories/product.repository';
import { promotionRepository } from '@/server/repositories/promotion.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { getOpenState } from '@/server/services/schedule.service';

export const revalidate = 60;

/**
 * Sólo la destacada se prerenderiza: es la única que la landing enlaza. El
 * resto de las promociones vigentes siguen teniendo página —`dynamicParams`
 * queda en su default— pero se generan cuando alguien las pide.
 */
export async function generateStaticParams() {
  const featured = await promotionRepository.findFeaturedBundle();
  return featured ? [{ slug: featured.slug }] : [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [promo, settings] = await Promise.all([
    promotionRepository.findBundleBySlug(slug),
    settingsRepository.get(),
  ]);

  if (!promo) return { title: 'Promoción no encontrada' };

  const description =
    promo.description ??
    `${promo.bundleSize} pizzas de ${promo.bundleSizeLabel ?? promo.bundleVariantName} por ${formatMoney(promo.value)} en ${settings.name}.`;

  return {
    title: `${promo.name} — ${settings.name}`,
    description,
    alternates: { canonical: promoPath(promo.slug) },
    openGraph: {
      type: 'website',
      title: `${promo.name} — ${settings.name}`,
      description,
      ...(promo.image ? { images: [{ url: promo.image }] } : {}),
    },
  };
}

export default async function PromoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [promotion, products, settings, open] = await Promise.all([
    promotionRepository.findBundleBySlug(slug),
    productRepository.findAllForMenu(),
    settingsRepository.get(),
    // Mismo check que aplica `placeOrder`.
    getOpenState(),
  ]);

  if (!promotion) notFound();

  // Mismo builder que la landing: si la promo no se puede armar —ninguna pizza
  // del tamaño disponible— la página 404 en vez de abrir un armador vacío.
  const promo = buildDuoPromoView(promotion, products);
  if (!promo) notFound();

  const eligibleIds = new Set(promo.options.map((option) => option.productId));
  const eligibleProducts = products.filter((product) => eligibleIds.has(product.id));

  const site = publicEnv.NEXT_PUBLIC_APP_URL;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: promo.name,
    url: `${site}${promoPath(slug)}`,
    price: (promo.bundlePrice / 10 ** currencyDecimals).toFixed(currencyDecimals),
    priceCurrency: currencyCode,
    availability: open.isOpen ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    ...(promo.description ? { description: promo.description } : {}),
    seller: { '@type': 'Restaurant', name: settings.name, url: site },
  };

  return (
    <div className="pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <nav
          aria-label="Migas de pan"
          className="text-muted-foreground mb-6 flex items-center gap-1 text-sm"
        >
          <Link href="/" className="hover:text-foreground transition-colors">
            Inicio
          </Link>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <span className="text-foreground truncate font-medium" aria-current="page">
            {promo.name}
          </span>
        </nav>

        {!open.isOpen && (
          <ClosedNotice className="mb-6">
            {open.reason} Puedes armar tu dúo, pero todavía no recibimos pedidos.
          </ClosedNotice>
        )}
      </div>

      {/* La misma card que la landing, con el mismo armador. Repetir el bloque
          en vez de inventar una variante de página es lo que garantiza que el
          precio del enlace compartido y el de la portada sean el mismo. */}
      <DuoPromoCard promo={promo} openState={open} />

      <section className="mx-auto mt-12 max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display mb-3 text-2xl font-bold">Cómo funciona</h2>
        <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            Toca «Armar mi dúo» y elige {promo.bundleSize} pizzas de {promo.sizeLabel}. Pueden ser
            dos sabores distintos o dos veces el mismo.
          </li>
          <li>
            Las dos entran al carrito como líneas normales, con su precio de lista, y el descuento
            aparece abajo como «{promo.name}». Puedes editarlas o sumarles agregados.
          </li>
          <li>
            Pagas {formatMoney(promo.bundlePrice)} por el par, elijas los sabores que elijas. Los
            agregados se cobran aparte.
          </li>
        </ol>
        <p className="text-muted-foreground mt-4 text-sm">
          Si sacas una de las dos del carrito, la promo se cae sola y cada pizza vuelve a su precio
          normal. El total lo recalcula el servidor al confirmar, así que lo que ves es lo que se
          cobra.
        </p>
      </section>

      {eligibleProducts.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display mb-1 text-2xl font-bold">Las que entran en la promo</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Toca cualquiera para ver de qué está hecha.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {eligibleProducts.map((product) => (
              <ProductCard key={product.id} product={toProductView(product)} />
            ))}
          </div>
          <p className="text-muted-foreground mt-6 text-sm">
            ¿Prefieres una sola?{' '}
            <Link href="/#menu" className="text-primary underline-offset-4 hover:underline">
              Mira la carta completa
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
