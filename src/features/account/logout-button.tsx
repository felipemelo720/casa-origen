'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { logoutCustomerAction } from '@/server/actions/customer-auth.actions';

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutCustomerAction(undefined);
          router.refresh();
        })
      }
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </Button>
  );
}
