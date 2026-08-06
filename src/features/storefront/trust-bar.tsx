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

  // Dropped entirely when there is no minimum, instead of printing "Sin
  // mínimo": a row about a rule that does not exist is noise.
  if (minOrderAmount > 0) {
    items.push({ icon: Wallet, value: formatMoney(minOrderAmount), label: 'Pedido mínimo' });
  }

  return (
    <section className="border-border bg-secondary/40 border-b">
      {/* Flex, not a fixed 4-column grid: the items are conditional (two of
          them disappear with delivery off), and a grid left an empty cell that
          pushed everything off-center. `flex-1` splits the row evenly for any
          count, and each item centers inside its own share. */}
      <div className="divide-border mx-auto flex max-w-7xl flex-wrap items-center gap-y-6 px-4 py-6 sm:divide-x sm:px-6 lg:px-8">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex basis-1/2 items-center justify-center gap-3 sm:basis-0 sm:flex-1 sm:px-4"
          >
            <item.icon className="text-primary size-5 shrink-0" aria-hidden />
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
