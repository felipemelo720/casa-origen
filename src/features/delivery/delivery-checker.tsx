'use client';

import { useState } from 'react';
import { Bike, Clock, MapPin, Store } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney } from '@/lib/money';

export type DeliveryZone = {
  id: string;
  name: string;
  deliveryFee: number;
  minOrder: number;
  extraMinutes: number;
};

type Props = {
  zones: DeliveryZone[];
  deliveryEnabled: boolean;
  baseEtaMinutes: number;
  pickupEtaMinutes: number;
};

/**
 * Answers "do you reach me, how much and how long" before the customer builds a
 * cart — the question that otherwise only gets answered at checkout, once the
 * work of choosing is already done.
 */
export function DeliveryChecker({ zones, deliveryEnabled, baseEtaMinutes, pickupEtaMinutes }: Props) {
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
        <MapPin className="text-primary size-5" />
        <h2 className="font-display text-lg font-semibold">¿Llegamos a ti?</h2>
      </div>

      <Select value={zoneId} onValueChange={setZoneId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Elige tu sector" />
        </SelectTrigger>
        <SelectContent>
          {zones.map((z) => (
            <SelectItem key={z.id} value={z.id}>
              {z.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {zone ? (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-background rounded-xl p-3">
            <Bike className="text-muted-foreground mx-auto size-4" />
            <p className="mt-1 text-sm font-semibold">
              {zone.deliveryFee === 0 ? 'Gratis' : formatMoney(zone.deliveryFee)}
            </p>
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Despacho</p>
          </div>
          <div className="bg-background rounded-xl p-3">
            <Clock className="text-muted-foreground mx-auto size-4" />
            <p className="mt-1 text-sm font-semibold">{baseEtaMinutes + zone.extraMinutes} min</p>
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Estimado</p>
          </div>
          <div className="bg-background rounded-xl p-3">
            <p className="mt-4 text-sm font-semibold">
              {zone.minOrder === 0 ? 'Sin mínimo' : formatMoney(zone.minOrder)}
            </p>
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Pedido mínimo</p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Repartimos en {zones.map((z) => z.name).join(', ')}.
        </p>
      )}
    </div>
  );
}
