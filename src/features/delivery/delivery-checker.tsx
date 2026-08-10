'use client';

import { useState } from 'react';
import { Bike, Clock, MapPin, MessageCircle, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoneyRange } from '@/lib/money';

export type DeliveryZone = {
  id: string;
  name: string;
  deliveryFee: number;
  deliveryFeeMin: number;
  deliveryFeeMax: number;
  extraMinutes: number;
};

type Props = {
  zones: DeliveryZone[];
  deliveryEnabled: boolean;
  baseEtaMinutes: number;
  pickupEtaMinutes: number;
  /** `null` hides the quote CTA rather than opening a dead wa.me link. */
  quoteUrl: string | null;
};

/**
 * Answers "do you reach me, how much and how long" before the customer builds a
 * cart — the question that otherwise only gets answered at checkout, once the
 * work of choosing is already done.
 *
 * The fee is a band, not a figure: it really depends on the address inside the
 * zone. So the honest answer is the band plus a way to get the exact number,
 * which is what the quote button is for.
 */
export function DeliveryChecker({
  zones,
  deliveryEnabled,
  baseEtaMinutes,
  pickupEtaMinutes,
  quoteUrl,
}: Props) {
  const [zoneId, setZoneId] = useState<string>();
  const zone = zones.find((z) => z.id === zoneId);

  if (!deliveryEnabled) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border p-6 text-center">
        <Store className="text-muted-foreground size-6" />
        <p className="font-display text-lg font-semibold">Solo retiro en tienda</p>
        <p className="text-muted-foreground text-sm">
          El delivery está pausado por ahora. Tu pedido queda listo en {pickupEtaMinutes} minutos.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-2xl border p-6">
      <div className="flex items-center gap-2">
        <MapPin className="text-primary size-5" aria-hidden />
        <h2 className="font-display text-lg font-semibold">¿Llegamos a ti?</h2>
      </div>

      <Select value={zoneId} onValueChange={setZoneId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Elige tu sector" />
        </SelectTrigger>
        <SelectContent>
          {zones.map((z) => (
            // `whitespace-normal`: one zone is a list of eight localities and
            // truncating it would hide exactly the name someone is looking for.
            <SelectItem key={z.id} value={z.id} className="whitespace-normal">
              {z.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* `aria-live`: picking a zone swaps the tiles below without moving focus,
          so a screen reader would otherwise get nothing back. */}
      <div aria-live="polite">
        {zone ? (
          // Two tiles, not three: there is no minimum order any more, so the
          // third one had nothing to say.
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-background rounded-xl p-3">
              <Bike className="text-muted-foreground mx-auto size-4" aria-hidden />
              <p className="mt-1 text-sm font-semibold">
                {zone.deliveryFeeMin === 0 && zone.deliveryFeeMax === 0
                  ? 'Gratis'
                  : formatMoneyRange(zone.deliveryFeeMin, zone.deliveryFeeMax)}
              </p>
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Despacho</p>
            </div>
            <div className="bg-background rounded-xl p-3">
              <Clock className="text-muted-foreground mx-auto size-4" aria-hidden />
              <p className="mt-1 text-sm font-semibold">{baseEtaMinutes + zone.extraMinutes} min</p>
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Estimado</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Repartimos en todo Paine. Elige tu sector para ver el valor y el tiempo.
          </p>
        )}
      </div>

      {/* The whole table, not just the selected row: someone who cannot find
          their own locality assumes we do not reach them and leaves. A plain
          list beats a scroll container here — eight rows fit. */}
      <details className="group border-border border-t pt-4">
        <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring cursor-pointer list-none rounded text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
          Ver todos los sectores y valores
          <span className="ml-1 inline-block transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </summary>
        <ul className="divide-border mt-3 divide-y text-sm">
          {zones.map((z) => (
            <li key={z.id} className="flex items-baseline justify-between gap-4 py-2">
              <span className="min-w-0">{z.name}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {z.deliveryFeeMin === 0 && z.deliveryFeeMax === 0
                  ? 'Gratis'
                  : formatMoneyRange(z.deliveryFeeMin, z.deliveryFeeMax)}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {quoteUrl && (
        <div className="border-border space-y-2 border-t pt-4">
          <p className="text-muted-foreground text-sm">
            ¿Quieres el valor exacto? Mándanos tu ubicación por WhatsApp y te lo confirmamos.
          </p>
          <Button asChild variant="outline" className="h-11 w-full">
            <a href={quoteUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" aria-hidden />
              Cotizar mi despacho
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
