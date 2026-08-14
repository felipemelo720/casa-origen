'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ComboPromoView } from '@/features/promo/combo-promo-view';
import type { OpenState } from '@/server/services/schedule.service';

// Mismo trato que el armador del dúo: es lo más pesado de la landing (sheet,
// grilla, motion) y la mayoría va directo al menú. Sólo viaja si alguien toca.
const ComboBuilder = dynamic(() =>
  import('@/features/promo/combo-builder').then((module) => module.ComboBuilder),
);

export function ComboPromoCta({
  promo,
  openState,
}: {
  promo: ComboPromoView;
  openState: OpenState;
}) {
  const [open, setOpen] = useState(false);
  // El sheet se desmonta al cerrar, pero el chunk no debería volver a pedirse:
  // el componente queda montado después de la primera apertura.
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
        Armar mi combo
      </Button>

      {loaded && (
        <ComboBuilder promo={promo} open={open} onOpenChange={setOpen} openState={openState} />
      )}
    </>
  );
}
