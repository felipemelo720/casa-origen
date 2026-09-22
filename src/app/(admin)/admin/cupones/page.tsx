import Link from 'next/link';
import { Plus } from 'lucide-react';

import { createCouponAction } from '@/server/actions/coupon.actions';
import { couponRepository } from '@/server/repositories/promotion.repository';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { AdminPageHeader } from '@/features/admin/admin-page-header';
import { NewCouponFields } from '@/features/admin/coupon-fields';
import { CouponRow } from '@/features/admin/coupon-row';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Cupones — Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

/**
 * Cupones vigentes y alta. Desde `xl` el formulario va al costado de la lista;
 * en el teléfono va debajo y «Nuevo» baja hasta él con un ancla — sin panel
 * lateral, que sería JS de cliente solo para mover un formulario.
 */
export default async function AdminCouponsPage() {
  // Los cupones apagados siguen en la lista porque apagar es la única forma
  // de retirar uno (borrarlo se llevaría las redenciones).
  const coupons = await couponRepository.findAllForAdmin();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title="Cupones"
        description="El cliente escribe el código en el checkout. «Mostrar en la web» además lo publica en la portada; sin eso el código existe pero no se anuncia en ninguna parte."
        actions={
          <Button asChild className="h-11 xl:hidden">
            <a href="#cupon-nuevo">
              <Plus aria-hidden="true" />
              Nuevo
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem] xl:items-start">
        <section aria-label="Cupones existentes" className="min-w-0 space-y-2">
          {coupons.length === 0 ? (
            <p className="text-muted-foreground border-border rounded-xl border border-dashed p-6 text-center text-sm">
              Todavía no hay cupones.{' '}
              <Link href="#cupon-nuevo" className="text-primary underline underline-offset-4">
                Crea el primero
              </Link>
              .
            </p>
          ) : (
            coupons.map((coupon) => <CouponRow key={coupon.id} coupon={coupon} />)
          )}
        </section>

        <section
          id="cupon-nuevo"
          aria-labelledby="cupon-nuevo-titulo"
          className="border-border bg-card scroll-mt-6 space-y-3 rounded-2xl border p-4 sm:p-6 xl:sticky xl:top-8"
        >
          <h2 id="cupon-nuevo-titulo" className="text-lg font-semibold">
            Cupón nuevo
          </h2>
          <AdminForm action={createCouponAction} className="space-y-3">
            <NewCouponFields />
            <AdminSubmit className="h-11 w-full">Crear cupón</AdminSubmit>
          </AdminForm>
        </section>
      </div>
    </div>
  );
}
