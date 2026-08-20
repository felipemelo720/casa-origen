import type { Metadata } from 'next';

import { ClosedNotice } from '@/components/shared/closed-notice';
import { ProductCard } from '@/features/catalog/product-card';
import { productPath, promoPath } from '@/features/catalog/product-path';
import { entryPrice, toProductView } from '@/features/catalog/product-view';
import { DeliveryChecker } from '@/features/delivery/delivery-checker';
import { ComboPromoCard } from '@/features/promo/combo-promo-card';
import { buildComboPromoView } from '@/features/promo/combo-promo-view';
import { DuoPromoCard } from '@/features/promo/duo-promo-card';
import { buildDuoPromoView } from '@/features/promo/duo-promo-view';
import { CouponBanner } from '@/features/storefront/coupon-banner';
import { EventOrders } from '@/features/storefront/event-orders';
import { StorefrontHero } from '@/features/storefront/hero';
import { HowToOrder } from '@/features/storefront/how-to-order';
import { OpeningHours } from '@/features/storefront/opening-hours';
import { RestaurantJsonLd } from '@/features/storefront/restaurant-jsonld';
import { TrustBar } from '@/features/storefront/trust-bar';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { HIGHLIGHTED_LIMIT, productRepository } from '@/server/repositories/product.repository';
import { getOpenState, getWeeklySchedule } from '@/server/services/schedule.service';
import {
  bannerRepository,
  communeRepository,
  settingsRepository,
} from '@/server/repositories/operations.repository';
import { couponRepository, promotionRepository } from '@/server/repositories/promotion.repository';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await settingsRepository.get();
  return {
    title: settings.seoTitle ?? settings.name,
    description: settings.seoDescription ?? settings.description ?? undefined,
  };
}

export default async function HomePage() {
  const [
    settings,
    heroBanners,
    products,
    highlighted,
    zones,
    open,
    schedule,
    featuredBundle,
    comboProduct,
    publicCoupon,
  ] = await Promise.all([
    settingsRepository.get(),
    bannerRepository.findActiveByPlacement('HERO'),
    productRepository.findAllForMenu(),
    productRepository.findHighlighted(HIGHLIGHTED_LIMIT),
    communeRepository.findAllActive(),
    // The same check the checkout enforces, so the landing cannot invite an
    // order that `placeOrder` will refuse a few clicks later.
    getOpenState(),
    getWeeklySchedule(),
    promotionRepository.findFeaturedBundle(),
    // Its own query and not part of `findAllForMenu`: the combo is deliberately
    // `isVisible: false`, so the menu pass cannot see it.
    productRepository.findComboPromo(),
    couponRepository.findPublicActive(),
  ]);

  const hero = heroBanners[0];

  // Built from the menu already fetched, so the builder can never offer a pizza
  // the carta below is not showing.
  const duoPromo = buildDuoPromoView(featuredBundle, products);

  // Same reason: the combo's choices are named after catalogue products, so the
  // picker borrows their photos and their availability from the menu already
  // fetched instead of asking again.
  const comboPromo = buildComboPromoView(comboProduct, products);

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

  // El «desde» del hero sale de la primera categoría de la carta, no del menú
  // entero: la más barata de todo el catálogo es una bebida, y anunciarla como
  // precio de entrada sería cierto y engañoso a la vez. Se calcula sobre los
  // productos ya traídos, sin query extra.
  const leadCategory = menuByCategory[0];
  const leadPrices = (leadCategory?.items ?? [])
    .filter((product) => product.availability === 'AVAILABLE')
    .map((product) => entryPrice(toProductView(product)));
  const priceFrom =
    leadCategory && leadPrices.length > 0
      ? { categoryName: leadCategory.category.name, amount: Math.min(...leadPrices) }
      : null;

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

      {/* Sin `kicker`: era `settings.tagline` («Cocina de origen, sabor de
          siempre») encima del título del banner («Cocina de origen»), o sea la
          misma frase dos veces. La tagline sigue viva en el footer. */}
      <StorefrontHero
        title={hero?.title ?? settings.name}
        subtitle={hero?.subtitle ?? settings.description}
        image={hero?.image ?? null}
        open={open}
        priceFrom={priceFrom}
      />

      <TrustBar
        deliveryEnabled={settings.deliveryEnabled}
        deliveryEtaMinutes={settings.deliveryEtaMinutes}
        pickupEtaMinutes={settings.pickupEtaMinutes}
        minOrderAmount={settings.minOrderAmount}
        // Cheapest zone on offer. Computed here because the trust bar renders
        // above the checker and has no zone list of its own.
        deliveryFeeFrom={
          zones.length > 0 ? Math.min(...zones.map((zone) => zone.deliveryFeeMin)) : null
        }
      />

      {publicCoupon && <CouponBanner coupon={publicCoupon} />}

      {duoPromo && featuredBundle && (
        <DuoPromoCard
          promo={duoPromo}
          openState={open}
          detailHref={promoPath(featuredBundle.slug)}
        />
      )}

      {/* Debajo del dúo: es la oferta más chica de las dos, y la que baja más
          el precio de un pedido completo va primero. */}
      {comboPromo && comboProduct && (
        <ComboPromoCard
          promo={comboPromo}
          openState={open}
          detailHref={productPath(comboProduct.slug)}
        />
      )}

      {highlighted.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          {/* La entrada va en el encabezado y en cada card por separado: si
              envolviera la sección entera, el grid animaría como un bloque y
              el escalonado por fila se perdería. */}
          <h2 className="font-display reveal mb-1 text-2xl font-bold">Los más pedidos</h2>
          <p className="text-muted-foreground reveal mb-6 text-sm">
            Lo que más sale de nuestro horno.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {highlighted.map((product) => (
              // Recortado acá: `ProductCard` es client component y la fila de
              // Prisma entera viaja al payload RSC producto por producto.
              <ProductCard key={product.id} product={toProductView(product)} />
            ))}
          </div>
        </section>
      )}

      {/* Above the menu on purpose: coverage, fee and minimum are what decide
          whether building a cart is worth it at all. */}
      <section
        id="cobertura"
        className="reveal mx-auto max-w-3xl scroll-mt-28 px-4 pt-12 sm:px-6 lg:px-8"
      >
        <DeliveryChecker
          // Narrowed here rather than passed whole: `DeliveryChecker` is a
          // client component and these are Prisma rows.
          zones={zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            deliveryFee: zone.deliveryFee,
            deliveryFeeMin: zone.deliveryFeeMin,
            deliveryFeeMax: zone.deliveryFeeMax,
            extraMinutes: zone.extraMinutes,
          }))}
          deliveryEnabled={settings.deliveryEnabled}
          baseEtaMinutes={settings.deliveryEtaMinutes}
          pickupEtaMinutes={settings.pickupEtaMinutes}
          quoteUrl={
            settings.whatsapp
              ? buildWhatsAppUrl(
                  settings.whatsapp,
                  `Hola ${settings.name}, quiero cotizar el despacho a mi dirección. Les comparto mi ubicación.`,
                )
              : null
          }
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
            <h2 className="font-display reveal mb-6 text-2xl font-bold">{category.name}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((product) => (
                <ProductCard key={product.id} product={toProductView(product)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* After the menu on purpose: it only makes sense once you have seen what
          a pizza costs, and it must not push the carta further down. */}
      <EventOrders
        restaurantName={settings.name}
        whatsapp={settings.whatsapp}
        phone={settings.phone}
      />

      <HowToOrder whatsappEnabled={Boolean(settings.whatsapp)} />

      <section
        id="horarios"
        className="reveal mx-auto max-w-3xl scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8"
      >
        <OpeningHours schedule={schedule} open={open} />
      </section>
    </div>
  );
}
