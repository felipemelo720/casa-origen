'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { DuoPromoView } from '@/features/promo/duo-promo-view';
import type { OpenState } from '@/server/services/schedule.service';

// The builder is the heaviest thing on the landing (grid, sheet, motion) and
// most visitors go straight to the menu. It only ships once somebody taps.
const DuoBuilder = dynamic(() =>
  import('@/features/promo/duo-builder').then((module) => module.DuoBuilder),
);

export function DuoPromoCta({ promo, openState }: { promo: DuoPromoView; openState: OpenState }) {
  const [open, setOpen] = useState(false);
  // The sheet unmounts on close, but the chunk should not be re-requested, so
  // the component stays mounted after the first open.
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="lg"
        // Vive dentro de un bloque `bg-primary`: el `default` se perdería
        // contra su propio fondo.
        variant="onPrimary"
        className="min-h-11 w-full sm:w-auto"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        Armar mi dúo
      </Button>

      {loaded && (
        <DuoBuilder promo={promo} open={open} onOpenChange={setOpen} openState={openState} />
      )}
    </>
  );
}
