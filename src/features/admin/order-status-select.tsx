'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { OrderStatus } from '@prisma/client';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ORDER_STATUS_LABEL } from '@/constants/order-status';
import { updateOrderStatusAction } from '@/server/actions/order-tracking.actions';

export function OrderStatusSelect({
  orderId,
  status,
  allowedNext,
}: {
  orderId: string;
  status: OrderStatus;
  allowedNext: OrderStatus[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (allowedNext.length === 0) {
    return (
      <Badge variant={status === 'CANCELLED' ? 'destructive' : 'secondary'}>
        {ORDER_STATUS_LABEL[status]}
      </Badge>
    );
  }

  function handleChange(value: string) {
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId, toStatus: value as OrderStatus });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Pedido → ${ORDER_STATUS_LABEL[value as OrderStatus]}`);
      router.refresh();
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={status}>{ORDER_STATUS_LABEL[status]}</SelectItem>
        {allowedNext.map((next) => (
          <SelectItem key={next} value={next}>
            {ORDER_STATUS_LABEL[next]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
