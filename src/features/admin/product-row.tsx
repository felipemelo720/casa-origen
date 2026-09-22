import Image from 'next/image';
import Link from 'next/link';
import { Pencil } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { setProductActiveAction } from '@/server/actions/product.actions';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

type ProductRowValues = {
  id: string;
  name: string;
  image: string | null;
  price: number;
  offerPrice: number | null;
  isActive: boolean;
  categoryName: string;
};

/** Una fila del listado de `/admin/productos`, pensada para 360px. */
export function ProductRow({ product }: { product: ProductRowValues }) {
  return (
    <div
      className={cn(
        'border-border flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0',
        !product.isActive && 'opacity-60',
      )}
    >
      {product.image ? (
        <Image
          src={product.image}
          alt=""
          width={44}
          height={44}
          className="border-border size-11 shrink-0 rounded-lg border object-cover"
        />
      ) : (
        <div
          className="bg-secondary border-border size-11 shrink-0 rounded-lg border"
          aria-hidden="true"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {product.categoryName} ·{' '}
          {product.offerPrice ? (
            <>
              <span className="line-through">{formatMoney(product.price)}</span>{' '}
              {formatMoney(product.offerPrice)}
            </>
          ) : (
            formatMoney(product.price)
          )}
          {!product.isActive && ' · Eliminado'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/admin/productos/${product.id}`}
          className="border-border hover:bg-secondary inline-flex size-11 items-center justify-center rounded-md border"
          aria-label={`Editar ${product.name}`}
          title="Editar"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Link>
        {product.isActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive h-11 px-3"
              >
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar {product.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deja de verse en la carta. Los pedidos ya hechos no se tocan y se puede republicar
                  después.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AdminForm
                  feedback="toast"
                  action={setProductActiveAction.bind(null, product.id, false)}
                >
                  <AlertDialogAction asChild>
                    <AdminSubmit variant="destructive" pendingLabel="…">
                      Eliminar
                    </AdminSubmit>
                  </AlertDialogAction>
                </AdminForm>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <AdminForm feedback="toast" action={setProductActiveAction.bind(null, product.id, true)}>
            <AdminSubmit
              variant="outline"
              pendingLabel="…"
              className="border-success/40 text-success h-11 px-3"
            >
              Republicar
            </AdminSubmit>
          </AdminForm>
        )}
      </div>
    </div>
  );
}
