import type { Metadata } from 'next';

import { TrackOrderForm } from '@/features/orders/track-order-form';

export const metadata: Metadata = { title: 'Seguimiento de pedido' };

export default function TrackOrderPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold">Seguimiento de pedido</h1>
      <p className="text-muted-foreground mt-2">Ingresa el código que recibiste al confirmar tu pedido.</p>
      <TrackOrderForm />
    </div>
  );
}
