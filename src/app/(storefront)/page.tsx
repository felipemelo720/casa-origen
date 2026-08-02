import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Flame } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProductCard } from '@/features/catalog/product-card';
import { productRepository } from '@/server/repositories/product.repository';
import { categoryRepository } from '@/server/repositories/category.repository';
import { bannerRepository } from '@/server/repositories/operations.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await settingsRepository.get();
  return {
    title: settings.seoTitle ?? settings.name,
    description: settings.seoDescription ?? settings.description ?? undefined,
  };
}

export default async function HomePage() {
  const [settings, heroBanners, featured, bestSellers, categories] = await Promise.all([
    settingsRepository.get(),
    bannerRepository.findActiveByPlacement('HERO'),
    productRepository.findFeatured(8),
    productRepository.findBestSellers(8),
    categoryRepository.findMenuTree(),
  ]);

  const hero = heroBanners[0];

  return (
    <div>
      <section className="relative flex min-h-[70vh] items-center overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {hero ? (
            <Image
              src={hero.image}
              alt={hero.title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <div className="bg-secondary size-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </div>

        <div className="mx-auto max-w-3xl px-4 py-24 text-white sm:px-6 lg:px-8">
          <p className="animate-fade-up text-sm font-medium uppercase tracking-widest text-white/80">
            {settings.tagline}
          </p>
          <h1 className="font-display animate-fade-up mt-4 text-4xl font-bold leading-tight sm:text-6xl [animation-delay:100ms]">
            {hero?.title ?? settings.name}
          </h1>
          {(hero?.subtitle ?? settings.description) && (
            <p className="animate-fade-up mt-4 max-w-xl text-lg text-white/90 [animation-delay:200ms]">
              {hero?.subtitle ?? settings.description}
            </p>
          )}
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:300ms]">
            <Button size="lg" asChild>
              <Link href={hero?.ctaHref ?? '/menu'}>
                {hero?.ctaLabel ?? 'Ver el menú'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/menu/${category.slug}`}
              className="border-border bg-card hover:border-primary hover:text-primary rounded-full border px-5 py-2 text-sm font-medium transition-colors"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Destacados</h2>
            <Link href="/menu" className="text-primary flex items-center gap-1 text-sm font-medium">
              Ver todo <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-2">
            <Flame className="text-primary size-5" />
            <h2 className="font-display text-2xl font-bold">Los más pedidos</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
