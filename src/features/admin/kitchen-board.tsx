'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Ban, Clock } from 'lucide-react';
import type { OrderStatus } from '@prisma/client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ORDER_STATUS_LABEL } from '@/constants/order-status';
import { updateOrderStatusAction } from '@/server/actions/order-tracking.actions';
import { getActiveKitchenOrdersAction } from '@/server/actions/kitchen.actions';
import type { OrderDetail } from '@/server/repositories/order.repository';

const COLUMNS: { status: OrderStatus; nextStatus: OrderStatus; nextLabel: string }[] = [
  { status: 'NEW', nextStatus: 'CONFIRMED', nextLabel: 'Confirmar' },
  { status: 'CONFIRMED', nextStatus: 'PREPARING', nextLabel: 'Empezar a preparar' },
  { status: 'PREPARING', nextStatus: 'READY', nextLabel: 'Marcar listo' },
];

function OrderCard({ order, nextStatus, nextLabel }: { order: OrderDetail; nextStatus: OrderStatus; nextLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function advance() {
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId: order.id, toStatus: nextStatus });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId: order.id, toStatus: 'CANCELLED' });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  const minutesAgo = Math.round((Date.now() - new Date(order.placedAt).getTime()) / 60000);

  return (
    <div className="border-border bg-card space-y-2 rounded-xl border p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{order.code}</p>
          <p className="text-muted-foreground text-xs">
            {order.firstName} {order.lastName}
          </p>
        </div>
        <Badge variant={order.type === 'DELIVERY' ? 'secondary' : 'outline'}>
          {order.type === 'DELIVERY' ? 'Delivery' : 'Retiro'}
        </Badge>
      </div>

      <ul className="space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="font-medium">{item.quantity}×</span> {item.name}
            {item.variants.length > 0 && (
              <span className="text-muted-foreground">
                {' '}
                ({item.variants.map((v) => v.optionName).join(', ')})
              </span>
            )}
            {item.extras.length > 0 && (
              <span className="text-muted-foreground"> +{item.extras.map((e) => e.name).join(', ')}</span>
            )}
            {item.notes && <span className="text-muted-foreground block text-xs">Nota: {item.notes}</span>}
          </li>
        ))}
      </ul>

      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <Clock className="size-3" />
        hace {minutesAgo} min
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" disabled={pending} onClick={advance}>
          {nextLabel} <ArrowRight className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={cancel} aria-label="Cancelar pedido">
          <Ban className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function KitchenBoard({ initialOrders }: { initialOrders: OrderDetail[] }) {
  const query = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: async () => {
      const result = await getActiveKitchenOrdersAction(undefined);
      return result.ok ? result.data : initialOrders;
    },
    initialData: initialOrders,
    refetchInterval: 8000,
  });

  const orders = query.data;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnOrders = orders.filter((order) => order.status === column.status);
        return (
          <div key={column.status} className="space-y-3">
            <h2 className="font-display flex items-center justify-between text-lg font-semibold">
              {ORDER_STATUS_LABEL[column.status]}
              <Badge variant="secondary">{columnOrders.length}</Badge>
            </h2>
            <div className="space-y-3">
              {columnOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin pedidos.</p>
              ) : (
                columnOrders.map((order) => (
                  <OrderCard key={order.id} order={order} nextStatus={column.nextStatus} nextLabel={column.nextLabel} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
