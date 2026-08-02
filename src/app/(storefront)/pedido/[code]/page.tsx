import type { Metadata } from 'next';

import { OrderTrackingView } from '@/features/orders/order-tracking-view';

export const metadata: Metadata = { title: 'Tu pedido' };

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <OrderTrackingView code={code.toUpperCase()} />
    </div>
  );
}
