'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ActionResult } from '@/lib/result';

export function DeleteEntityButton({
  id,
  name,
  description,
  action,
}: {
  id: string;
  name: string;
  description?: string;
  action: (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await action({ id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success('Eliminado correctamente.');
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Eliminar ${name}`}>
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar &quot;{name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? 'Esta acción no se puede deshacer.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={handleConfirm}>
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
