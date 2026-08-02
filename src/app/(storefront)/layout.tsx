import { StorefrontHeader } from '@/components/layout/storefront-header';
import { StorefrontFooter } from '@/components/layout/storefront-footer';
import { CartDrawer } from '@/features/cart/cart-drawer';
import { settingsRepository } from '@/server/repositories/operations.repository';

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await settingsRepository.get();

  return (
    <div className="flex min-h-dvh flex-col">
      <StorefrontHeader restaurantName={settings.name} />
      <main className="flex-1">{children}</main>
      <StorefrontFooter
        restaurantName={settings.name}
        phone={settings.phone}
        address={settings.address}
        instagramUrl={settings.instagramUrl}
        facebookUrl={settings.facebookUrl}
      />
      <CartDrawer />
    </div>
  );
}
