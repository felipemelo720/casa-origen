import { StorefrontHeader } from '@/components/layout/storefront-header';
import { StorefrontFooter } from '@/components/layout/storefront-footer';
import { CartDrawerMount } from '@/features/cart/cart-drawer-mount';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { productRepository } from '@/server/repositories/product.repository';
import {
  communeRepository,
  paymentMethodRepository,
  settingsRepository,
} from '@/server/repositories/operations.repository';
import { promotionRepository } from '@/server/repositories/promotion.repository';
import { getOpenState, getWeeklySchedule } from '@/server/services/schedule.service';
import { toBundleRule } from '@/features/promo/duo-promo-view';
import type { CartAddOn } from '@/features/cart/cart-drawer';
import type { CheckoutOptions } from '@/features/checkout/checkout-form';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // Same check the checkout enforces, so the badge cannot say "abierto" while
  // `placeOrder` refuses the order.
  const [settings, open, schedule, addOns, communes, paymentMethods, featuredBundle] =
    await Promise.all([
      settingsRepository.get(),
      getOpenState(),
      getWeeklySchedule(),
      productRepository.findAddOnsByProduct(),
      // Rendered by the checkout inside the drawer. Loaded here so the form is
      // complete on its first paint instead of fetching after it opens.
      communeRepository.findAllActive(),
      paymentMethodRepository.findAllActive(),
      // The drawer lives in the layout, so the bundle rule has to be resolved
      // here too: the cart is reachable from every storefront route, not only
      // from the landing that renders the promo card.
      promotionRepository.findFeaturedBundle(),
    ]);

  // Keyed by product so the drawer can look up a line's add-ons in one hop.
  // Narrowed here: `CartDrawer` is a client component and these are Prisma rows.
  const addOnsByProduct = addOns.reduce<Record<string, CartAddOn[]>>((byProduct, row) => {
    (byProduct[row.productId] ??= []).push({
      extraId: row.extra.id,
      name: row.extra.name,
      price: row.priceOverride ?? row.extra.price,
      isPremium: row.extra.isPremium,
    });
    return byProduct;
  }, {});

  // Narrowed here for the same reason as `addOnsByProduct`: these are Prisma
  // rows and the checkout is a client component.
  const checkoutOptions: CheckoutOptions = {
    communes: communes.map((commune) => ({ id: commune.id, name: commune.name })),
    paymentMethods: paymentMethods.map((method) => ({
      id: method.id,
      name: method.name,
      description: method.description,
      instructions: method.instructions,
      requiresChange: method.requiresChange,
    })),
    deliveryEnabled: settings.deliveryEnabled,
  };

  const whatsappUrl = settings.whatsapp
    ? buildWhatsAppUrl(settings.whatsapp, `Hola ${settings.name}, quiero hacer un pedido.`)
    : null;
  const todayHours = schedule.find((day) => day.isToday) ?? null;

  return (
    <div className="flex min-h-dvh flex-col">
      <StorefrontHeader
        restaurantName={settings.name}
        logo={settings.logo}
        phone={settings.phone}
        whatsappUrl={whatsappUrl}
        open={open}
        todayHours={todayHours}
      />
      {/* Target of the header's skip link. */}
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <StorefrontFooter
        restaurantName={settings.name}
        tagline={settings.tagline}
        logo={settings.logo}
        phone={settings.phone}
        email={settings.email}
        whatsappUrl={whatsappUrl}
        instagramUrl={settings.instagramUrl}
        facebookUrl={settings.facebookUrl}
        schedule={schedule}
        deliveryEnabled={settings.deliveryEnabled}
        deliveryEtaMinutes={settings.deliveryEtaMinutes}
        pickupEtaMinutes={settings.pickupEtaMinutes}
      />
      <CartDrawerMount
        addOnsByProduct={addOnsByProduct}
        checkoutOptions={checkoutOptions}
        bundleRule={toBundleRule(featuredBundle)}
      />
    </div>
  );
}
