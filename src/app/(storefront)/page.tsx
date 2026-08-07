import type { Metadata } from 'next';

import { ClosedNotice } from '@/components/shared/closed-notice';
import { ProductCard } from '@/features/catalog/product-card';
import { DeliveryChecker } from '@/features/delivery/delivery-checker';
import { StorefrontHero } from '@/features/storefront/hero';
import { HowToOrder } from '@/features/storefront/how-to-order';
import { OpeningHours } from '@/features/storefront/opening-hours';
import { RestaurantJsonLd } from '@/features/storefront/restaurant-jsonld';
import { TrustBar } from '@/features/storefront/trust-bar';
import { HIGHLIGHTED_LIMIT, productRepository } from '@/server/repositories/product.repository';
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
  const [settings, heroBanners, products, highlighted, zones, open, schedule] = await Promise.all([
    settingsRepository.get(),
    bannerRepository.findActiveByPlacement('HERO'),
    productRepository.findAllForMenu(),
    productRepository.findHighlighted(HIGHLIGHTED_LIMIT),
    communeRepository.findAllActive(),
    // The same check the checkout enforces, so the landing cannot invite an
    // order that `placeOrder` will refuse a few clicks later.
    getOpenState(),
    getWeeklySchedule(),
  ]);

  const hero = heroBanners[0];

  // Grouped on the server so the menu stays one pass over the products already
  // fetched, in `sortOrder` order, with no extra query per category.
  const menuByCategory = [
    ...products
      .reduce((groups, product) => {
        const group = groups.get(product.category.id);
        if (group) group.items.push(product);
        else groups.set(product.category.id, { category: product.category, items: [product] });
        return groups;
      }, new Map<string, { category: (typeof products)[number]['category']; items: typeof products }>())
      .values(),
  ].sort((a, b) => a.category.sortOrder - b.category.sortOrder);

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

      <StorefrontHero
        kicker={settings.tagline}
        title={hero?.title ?? settings.name}
        subtitle={hero?.subtitle ?? settings.description}
        image={hero?.image ?? null}
        open={open}
      />

      <TrustBar
        deliveryEnabled={settings.deliveryEnabled}
        deliveryEtaMinutes={settings.deliveryEtaMinutes}
        pickupEtaMinutes={settings.pickupEtaMinutes}
        minOrderAmount={settings.minOrderAmount}
      />

      {highlighted.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <h2 className="font-display mb-1 text-2xl font-bold">Los más pedidos</h2>
          <p className="text-muted-foreground mb-6 text-sm">Lo que más sale de nuestro horno.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {highlighted.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Above the menu on purpose: coverage, fee and minimum are what decide
          whether building a cart is worth it at all. */}
      <section id="cobertura" className="mx-auto max-w-3xl scroll-mt-28 px-4 pt-12 sm:px-6 lg:px-8">
        <DeliveryChecker
          // Narrowed here rather than passed whole: `DeliveryChecker` is a
          // client component and these are Prisma rows.
          zones={zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            deliveryFee: zone.deliveryFee,
            extraMinutes: zone.extraMinutes,
          }))}
          deliveryEnabled={settings.deliveryEnabled}
          baseEtaMinutes={settings.deliveryEtaMinutes}
          pickupEtaMinutes={settings.pickupEtaMinutes}
        />
      </section>

      <section id="menu" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8">
        {/* Repeated here: anyone jumping straight to #menu never sees the hero. */}
        {!open.isOpen && (
          <ClosedNotice className="mb-6">
            {open.reason} Puedes mirar la carta, pero todavía no recibimos pedidos.
          </ClosedNotice>
        )}

        {/* One block per category instead of a single grid under a hardcoded
            "Nuestras pizzas": the carta also sells drinks, and they are not
            pizzas. */}
        {menuByCategory.map(({ category, items }) => (
          <div key={category.id} className="mb-10 last:mb-0">
            <h2 className="font-display mb-6 text-2xl font-bold">{category.name}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <HowToOrder whatsappEnabled={Boolean(settings.whatsapp)} />

      <section id="horarios" className="mx-auto max-w-3xl scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8">
        <OpeningHours schedule={schedule} open={open} />
      </section>
    </div>
  );
}
