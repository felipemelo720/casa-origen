import { settingsRepository } from '@/server/repositories/operations.repository';
import { SettingsForm } from '@/features/admin/settings-form';

export const metadata = { title: 'Configuración' };

export default async function AdminSettingsPage() {
  const settings = await settingsRepository.get();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Configuración</h1>
      <SettingsForm
        defaultValues={{
          name: settings.name,
          tagline: settings.tagline ?? '',
          description: settings.description ?? '',
          email: settings.email ?? '',
          phone: settings.phone ?? '',
          whatsapp: settings.whatsapp ?? '',
          address: settings.address ?? '',
          instagramUrl: settings.instagramUrl ?? '',
          facebookUrl: settings.facebookUrl ?? '',
          acceptingOrders: settings.acceptingOrders,
          closedMessage: settings.closedMessage ?? '',
          defaultDeliveryFee: settings.defaultDeliveryFee,
          freeDeliveryFrom: settings.freeDeliveryFrom,
          minOrderAmount: settings.minOrderAmount,
          deliveryEtaMinutes: settings.deliveryEtaMinutes,
          pickupEtaMinutes: settings.pickupEtaMinutes,
          seoTitle: settings.seoTitle ?? '',
          seoDescription: settings.seoDescription ?? '',
        }}
      />
    </div>
  );
}
