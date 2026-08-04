import { Bike, Clock, Store, Wallet } from 'lucide-react';

import { formatMoney } from '@/lib/money';

type Props = {
  deliveryEnabled: boolean;
  deliveryEtaMinutes: number;
  pickupEtaMinutes: number;
  freeDeliveryFrom: number;
  minOrderAmount: number;
};

/**
 * The four numbers that decide whether someone orders at all — ETA, free
 * delivery threshold and minimum. They live in settings but until now only
 * surfaced at checkout, once the customer had already done the choosing.
 */
export function TrustBar({
  deliveryEnabled,
  deliveryEtaMinutes,
  pickupEtaMinutes,
  freeDeliveryFrom,
  minOrderAmount,
}: Props) {
  const items: { icon: typeof Bike; value: string; label: string }[] = [];

  if (deliveryEnabled) {
    items.push({ icon: Bike, value: `${deliveryEtaMinutes} min`, label: 'Despacho' });
  }

  items.push({ icon: Store, value: `${pickupEtaMinutes} min`, label: 'Retiro en tienda' });

  if (deliveryEnabled && freeDeliveryFrom > 0) {
    items.push({ icon: Clock, value: formatMoney(freeDeliveryFrom), label: 'Envío gratis desde' });
  }

  items.push({
    icon: Wallet,
    value: minOrderAmount > 0 ? formatMoney(minOrderAmount) : 'Sin mínimo',
    label: 'Pedido mínimo',
  });

  return (
    <section className="border-border bg-secondary/40 border-b">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <item.icon className="text-primary size-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.value}</p>
              <p className="text-muted-foreground truncate text-xs">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
