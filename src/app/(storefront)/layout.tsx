import { StorefrontHeader } from '@/components/layout/storefront-header';
import { StorefrontFooter } from '@/components/layout/storefront-footer';
import { CartDrawer } from '@/features/cart/cart-drawer';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { productRepository } from '@/server/repositories/product.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { getOpenState, getWeeklySchedule } from '@/server/services/schedule.service';
import type { CartAddOn } from '@/features/cart/cart-drawer';

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Same check the checkout enforces, so the badge cannot say "abierto" while
  // `placeOrder` refuses the order.
  const [settings, open, schedule, addOns] = await Promise.all([
    settingsRepository.get(),
    getOpenState(),
    getWeeklySchedule(),
    productRepository.findAddOnsByProduct(),
  ]);

  // Keyed by product so the drawer can look up a line's add-ons in one hop.
  // Narrowed here: `CartDrawer` is a client component and these are Prisma rows.
  const addOnsByProduct = addOns.reduce<Record<string, CartAddOn[]>>((byProduct, row) => {
    (byProduct[row.productId] ??= []).push({
      extraId: row.extra.id,
      name: row.extra.name,
      price: row.priceOverride ?? row.extra.price,
    });
    return byProduct;
  }, {});

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
        address={settings.address}
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
        address={settings.address}
        instagramUrl={settings.instagramUrl}
        facebookUrl={settings.facebookUrl}
        schedule={schedule}
        deliveryEnabled={settings.deliveryEnabled}
        deliveryEtaMinutes={settings.deliveryEtaMinutes}
        pickupEtaMinutes={settings.pickupEtaMinutes}
      />
      <CartDrawer addOnsByProduct={addOnsByProduct} />
    </div>
  );
}
