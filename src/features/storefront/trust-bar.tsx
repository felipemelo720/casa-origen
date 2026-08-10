import { MapPin, Store, Wallet } from 'lucide-react';
import type { ComponentType } from 'react';

import { MotorcycleIcon } from '@/components/shared/motorcycle-icon';
import { formatMoney } from '@/lib/money';

type Props = {
  deliveryEnabled: boolean;
  deliveryEtaMinutes: number;
  pickupEtaMinutes: number;
  minOrderAmount: number;
  /** Cheapest zone fee, or `null` when no zone is active. */
  deliveryFeeFrom: number | null;
};

/**
 * The facts that decide whether someone orders at all — ETA, coverage and
 * minimum. They live in settings but until now only surfaced at checkout, once
 * the customer had already done the choosing.
 */
export function TrustBar({
  deliveryEnabled,
  deliveryEtaMinutes,
  pickupEtaMinutes,
  minOrderAmount,
  deliveryFeeFrom,
}: Props) {
  const items: {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    value: string;
    label: string;
  }[] = [];

  if (deliveryEnabled) {
    items.push({ icon: MotorcycleIcon, value: `${deliveryEtaMinutes} min`, label: 'Despacho' });
  }

  items.push({ icon: Store, value: `${pickupEtaMinutes} min`, label: 'Retiro en tienda' });

  // Price beats coverage in this slot: "Paine" only answered "¿me llega?",
  // which the checker below already answers in detail, while "¿cuánto sale el
  // despacho?" had no answer at all before the checkout. "Desde" is deliberate
  // — the fee is a band, and stating a flat figure here would contradict the
  // range the checker shows a screen later.
  if (deliveryEnabled && deliveryFeeFrom !== null) {
    items.push({
      icon: MapPin,
      value: deliveryFeeFrom === 0 ? 'Gratis' : `Desde ${formatMoney(deliveryFeeFrom)}`,
      label: 'Despacho en Paine',
    });
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
          count, and each item centers inside its own share.
          `justify-center` is for the odd count: with three items the mobile
          row wraps and the leftover one sat alone in the left half, reading as
          a broken layout. Centered, the orphan lines up under the pair. */}
      <div className="divide-border mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-y-6 px-4 py-6 sm:divide-x sm:px-6 lg:px-8">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex basis-1/2 items-center justify-center gap-3 sm:flex-1 sm:basis-0 sm:px-4"
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
