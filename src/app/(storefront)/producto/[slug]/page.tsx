import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Clock, Truck, Store } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ClosedNotice } from '@/components/shared/closed-notice';
import { ProductBuyPanel } from '@/features/catalog/product-buy-panel';
import { ProductCard } from '@/features/catalog/product-card';
import { ProductGallery } from '@/features/catalog/product-gallery';
import { ProductJsonLd } from '@/features/catalog/product-jsonld';
import { productPath } from '@/features/catalog/product-path';
import { priceRange, toProductDetailView, toProductView } from '@/features/catalog/product-view';
import { formatMoney } from '@/lib/money';
import { productRepository } from '@/server/repositories/product.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { getOpenState } from '@/server/services/schedule.service';

/** Misma ventana que la landing: la ficha es vitrina, no estado en vivo. */
export const revalidate = 60;

const RELATED_LIMIT = 4;

/**
 * Prerenderiza las fichas al build. Son pocas y fijas (la carta entera), así
 * que la primera visita a cualquiera de ellas ya sale de HTML estático en vez
 * de pagar una consulta contra Postgres.
 */
export async function generateStaticParams() {
  const products = await productRepository.findAllSlugs();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([
    productRepository.findBySlug(slug),
    settingsRepository.get(),
  ]);

  if (!product) return { title: 'Producto no encontrado' };

  const view = toProductDetailView(product);
  const { min } = priceRange(view);
  const description =
    view.description ??
    view.shortDescription ??
    `${view.name} en ${settings.name}. Desde ${formatMoney(min)}.`;

  return {
    title: `${view.name} — ${settings.name}`,
    description,
    alternates: { canonical: productPath(view.slug) },
    openGraph: {
      type: 'website',
      title: `${view.name} — ${settings.name}`,
      description,
      ...(view.image ? { images: [{ url: view.image }] } : {}),
    },
    // Un producto fuera de la carta (el combo) tiene página propia para poder
    // compartirse, pero no compite en el índice con la carta misma.
    ...(product.isVisible ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await productRepository.findBySlug(slug);
  if (!product) notFound();

  const [settings, open, related] = await Promise.all([
    settingsRepository.get(),
    // El mismo check que aplica `placeOrder`: la ficha no puede invitar a un
    // pedido que el checkout va a rechazar dos taps después.
    getOpenState(),
    productRepository.findRelated(product.categoryId, product.id, RELATED_LIMIT),
  ]);

  const view = toProductDetailView(product);
  const gallery =
    view.images.length > 0
      ? view.images
      : view.image
        ? [{ id: view.id, url: view.image, alt: view.name }]
        : [];
  const cover = gallery[0];
  const allergens = view.ingredients.filter((ingredient) => ingredient.isAllergen);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <ProductJsonLd product={view} restaurantName={settings.name} />

      <nav
        aria-label="Migas de pan"
        className="text-muted-foreground mb-6 flex items-center gap-1 text-sm"
      >
        <Link href="/" className="hover:text-foreground transition-colors">
          Inicio
        </Link>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        <Link href="/#menu" className="hover:text-foreground transition-colors">
          {view.category.name}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        <span className="text-foreground truncate font-medium" aria-current="page">
          {view.name}
        </span>
      </nav>

      {!open.isOpen && (
        <ClosedNotice className="mb-6">
          {open.reason} Puedes armar tu pedido, pero todavía no lo recibimos.
        </ClosedNotice>
      )}

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* ---- Foto ---- */}
        <div>
          {gallery.length > 1 ? (
            <ProductGallery images={gallery} name={view.name} />
          ) : cover ? (
            <div className="bg-muted relative aspect-square overflow-hidden rounded-2xl">
              <Image
                src={cover.url}
                alt={cover.alt ?? view.name}
                fill
                priority
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="bg-muted aspect-square rounded-2xl" />
          )}
        </div>

        {/* ---- Qué es y cómo se pide ---- */}
        <div className="flex flex-col gap-6">
          <div>
            {view.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {view.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className="border-none"
                    style={{ backgroundColor: tag.color, color: 'white' }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}

            <h1 className="font-display text-3xl font-bold sm:text-4xl">{view.name}</h1>

            {view.shortDescription && (
              <p className="text-muted-foreground mt-2 max-w-prose text-base">
                {view.shortDescription}
              </p>
            )}
          </div>

          {/* Las tres objeciones que se responden antes de elegir tamaño: cuánto
              demora, si llega y si se puede retirar. */}
          <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li className="flex items-center gap-1.5">
              <Clock className="size-4 shrink-0" aria-hidden />
              Listo en ~{view.prepMinutes} min
            </li>
            {settings.deliveryEnabled && (
              <li className="flex items-center gap-1.5">
                <Truck className="size-4 shrink-0" aria-hidden />
                Despacho en ~{settings.deliveryEtaMinutes} min
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <Store className="size-4 shrink-0" aria-hidden />
              Retiro en ~{settings.pickupEtaMinutes} min
            </li>
          </ul>

          <ProductBuyPanel product={view} />
        </div>
      </div>

      {(view.description || view.ingredients.length > 0) && (
        <section className="border-border mt-12 grid gap-8 border-t pt-8 sm:grid-cols-2 lg:gap-12">
          {view.description && (
            <div>
              <h2 className="font-display mb-2 text-xl font-bold">Sobre {view.name}</h2>
              <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                {view.description}
              </p>
            </div>
          )}

          {view.ingredients.length > 0 && (
            <div>
              <h2 className="font-display mb-2 text-xl font-bold">Lleva</h2>
              <ul className="text-muted-foreground flex flex-wrap gap-1.5 text-sm">
                {view.ingredients.map((ingredient) => (
                  <li
                    key={ingredient.id}
                    className="border-border bg-card rounded-lg border px-2.5 py-1"
                  >
                    {ingredient.name}
                    {ingredient.isAllergen && (
                      <span className="text-warning-emphasis ml-1 font-medium">· alérgeno</span>
                    )}
                  </li>
                ))}
              </ul>
              {allergens.length > 0 && (
                <p className="text-muted-foreground mt-3 text-xs">
                  Contiene {allergens.map((ingredient) => ingredient.name.toLowerCase()).join(', ')}
                  . Si tienes alguna alergia, avísanos al confirmar el pedido.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="border-border mt-12 border-t pt-8">
          <h2 className="font-display mb-6 text-2xl font-bold">También te puede gustar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((sibling) => (
              <ProductCard key={sibling.id} product={toProductView(sibling)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
