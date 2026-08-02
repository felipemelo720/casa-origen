'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { duplicateProductAction } from '@/server/actions/product.actions';

export function DuplicateProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await duplicateProductAction({ id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success('Producto duplicado.');
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="icon-sm" disabled={pending} onClick={handleClick} aria-label="Duplicar producto">
      <Copy className="size-3.5" />
    </Button>
  );
}
