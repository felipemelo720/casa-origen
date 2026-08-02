'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChefHat, Clock, Loader2, PackageCheck, Truck, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { trackOrderAction } from '@/server/actions/order-tracking.actions';
import { ORDER_STATUS_LABEL as STATUS_LABEL } from '@/constants/order-status';

type OrderStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  NEW: Clock,
  CONFIRMED: CheckCircle2,
  PREPARING: ChefHat,
  READY: PackageCheck,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: XCircle,
};

export function OrderTrackingView({ code }: { code: string }) {
  const query = useQuery({
    queryKey: ['order-tracking', code],
    queryFn: () => trackOrderAction({ code }),
    refetchInterval: (q) => (q.state.data?.ok && q.state.data.data.status === 'DELIVERED' ? false : 5000),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground">Buscando tu pedido…</p>
      </div>
    );
  }

  if (!query.data?.ok) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <XCircle className="text-destructive size-10" />
        <p className="font-medium">{query.data?.message ?? 'No encontramos ese pedido.'}</p>
        <p className="text-muted-foreground text-sm">Verifica el código e inténtalo nuevamente.</p>
      </div>
    );
  }

  const order = query.data.data;
  const isCancelled = order.status === 'CANCELLED';

  const steps: OrderStatus[] =
    order.type === 'DELIVERY'
      ? ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
      : ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];

  const currentIndex = steps.indexOf(order.status as OrderStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Pedido</p>
          <h1 className="font-display text-2xl font-bold">{order.code}</h1>
        </div>
        <Badge variant={isCancelled ? 'destructive' : 'secondary'}>
          {STATUS_LABEL[order.status as OrderStatus]}
        </Badge>
      </div>

      {order.firstName && <p className="text-muted-foreground">Gracias, {order.firstName}.</p>}

      {!isCancelled && (
        <ol className="space-y-4">
          {steps.map((status, index) => {
            const Icon = STATUS_ICON[status];
            const done = index <= currentIndex;
            const historyEntry = order.history.find((h) => h.toStatus === status);
            return (
              <li key={status} className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2',
                    done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="pt-1">
                  <p className={cn('text-sm font-medium', !done && 'text-muted-foreground')}>
                    {STATUS_LABEL[status]}
                  </p>
                  {historyEntry && (
                    <p className="text-muted-foreground text-xs">
                      {new Date(historyEntry.createdAt).toLocaleTimeString('es-CL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {historyEntry.note ? ` · ${historyEntry.note}` : ''}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {isCancelled && (
        <p className="text-muted-foreground">
          Este pedido fue cancelado. Si tienes dudas, contáctanos indicando el código {order.code}.
        </p>
      )}

      <Separator />

      <div className="space-y-1.5 text-sm">
        {order.estimatedMinutes && !isCancelled && order.status !== 'DELIVERED' && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tiempo estimado</span>
            <span>{order.estimatedMinutes} min</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatMoney(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
