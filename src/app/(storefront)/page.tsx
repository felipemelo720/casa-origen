import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowRight, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProductCard } from '@/features/catalog/product-card';
import { CouponBanner } from '@/features/promo/coupon-banner';
import { DeliveryChecker } from '@/features/delivery/delivery-checker';
import { HowToOrder } from '@/features/storefront/how-to-order';
import { OpeningHours } from '@/features/storefront/opening-hours';
import { RestaurantJsonLd } from '@/features/storefront/restaurant-jsonld';
import { TrustBar } from '@/features/storefront/trust-bar';
import { productRepository } from '@/server/repositories/product.repository';
import { couponRepository } from '@/server/repositories/promotion.repository';
import { getOpenState, getWeeklySchedule } from '@/server/services/schedule.service';
import {
  bannerRepository,
  communeRepository,
  settingsRepository,
} from '@/server/repositories/operations.repository';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await settingsRepository.get();
  return {
    title: settings.seoTitle ?? settings.name,
    description: settings.seoDescription ?? settings.description ?? undefined,
  };
}

export default async function HomePage() {
  const [settings, heroBanners, products, topSellers, coupon, zones, open, schedule] =
    await Promise.all([
      settingsRepository.get(),
      bannerRepository.findActiveByPlacement('HERO'),
      productRepository.findAllForMenu(),
      productRepository.findTopSellers(4),
      couponRepository.findPublicActive(),
      communeRepository.findAllActive(),
      // The same check the checkout enforces, so the landing cannot invite an
      // order that `placeOrder` will refuse a few clicks later.
      getOpenState(),
      getWeeklySchedule(),
    ]);

  const hero = heroBanners[0];

  return (
    <div>
      <RestaurantJsonLd
        name={settings.name}
        description={settings.seoDescription ?? settings.description}
        image={settings.seoImage ?? hero?.image ?? null}
        phone={settings.phone}
        address={settings.address}
        instagramUrl={settings.instagramUrl}
        facebookUrl={settings.facebookUrl}
        schedule={schedule}
      />

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
          <p className="animate-fade-up text-sm font-medium tracking-widest text-white/80 uppercase">
            {settings.tagline}
          </p>
          <h1 className="font-display animate-fade-up mt-4 text-4xl leading-tight font-bold sm:text-6xl [animation-delay:100ms]">
            {hero?.title ?? settings.name}
          </h1>
          {(hero?.subtitle ?? settings.description) && (
            <p className="animate-fade-up mt-4 max-w-xl text-lg text-white/90 [animation-delay:200ms]">
              {hero?.subtitle ?? settings.description}
            </p>
          )}
          {!open.isOpen && (
            <p className="animate-fade-up mt-4 flex max-w-xl items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-2 text-sm font-medium text-amber-200 [animation-delay:250ms]">
              <Clock className="size-4 shrink-0" />
              <span>
                {open.reason}
                {open.reopensAt && ` Abrimos a las ${open.reopensAt}.`}
              </span>
            </p>
          )}
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:300ms]">
            <Button size="lg" asChild>
              <a href="#menu">
                {open.isOpen ? 'Ver el menú' : 'Ver el menú igual'}
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <TrustBar
        deliveryEnabled={settings.deliveryEnabled}
        deliveryEtaMinutes={settings.deliveryEtaMinutes}
        pickupEtaMinutes={settings.pickupEtaMinutes}
        freeDeliveryFrom={settings.freeDeliveryFrom}
        minOrderAmount={settings.minOrderAmount}
      />

      {coupon && (
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <CouponBanner coupon={coupon} />
        </section>
      )}

      {topSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <h2 className="font-display mb-1 text-2xl font-bold">Los más pedidos</h2>
          <p className="text-muted-foreground mb-6 text-sm">Lo que más sale de nuestro horno.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {topSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Above the menu on purpose: coverage, fee and minimum are what decide
          whether building a cart is worth it at all. */}
      <section className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 lg:px-8">
        <DeliveryChecker
          zones={zones}
          deliveryEnabled={settings.deliveryEnabled}
          baseEtaMinutes={settings.deliveryEtaMinutes}
          pickupEtaMinutes={settings.pickupEtaMinutes}
        />
      </section>

      <section id="menu" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <h2 className="font-display text-2xl font-bold">Nuestras pizzas</h2>
          {/* Repeated here: anyone jumping straight to #menu never sees the hero. */}
          {!open.isOpen && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <Clock className="size-4 shrink-0" />
              <span>
                {open.reason}
                {open.reopensAt && ` Abrimos a las ${open.reopensAt}.`} Puedes mirar la carta, pero
                todavía no recibimos pedidos.
              </span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <HowToOrder whatsappEnabled={Boolean(settings.whatsapp)} />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <OpeningHours schedule={schedule} open={open} />
      </section>
    </div>
  );
}
