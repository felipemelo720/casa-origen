import { Badge } from '@/components/ui/badge';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { CouponFields } from '@/features/admin/coupon-fields';
import { setCouponActiveAction, updateCouponAction } from '@/server/actions/coupon.actions';
import { SHOP_TIME_ZONE } from '@/server/services/schedule.service';
import { describeCouponBenefit } from '@/lib/coupon-copy';
import { cn } from '@/lib/utils';

export type AdminCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED' | 'BUNDLE_PRICE';
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  freeDelivery: boolean;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number;
  isActive: boolean;
  isPublic: boolean;
  endsAt: Date | null;
};

/**
 * Un cupón en el panel, pensado para 360px: el código y lo que entrega mandan,
 * el resto baja a una línea de datos y el botón queda a la derecha con los
 * 44px de alto que pide cualquier objetivo táctil.
 *
 * Server component: lo único interactivo es el form del toggle, que ya trae su
 * propia frontera cliente en `AdminForm`.
 */
export function CouponRow({ coupon }: { coupon: AdminCoupon }) {
  const usage =
    coupon.usageLimit === null
      ? `${coupon.usageCount} ${coupon.usageCount === 1 ? 'uso' : 'usos'}`
      : `${coupon.usageCount} de ${coupon.usageLimit} usos`;

  const exhausted = coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit;
  const expired = coupon.endsAt !== null && coupon.endsAt.getTime() <= Date.now();

  return (
    <div className={cn('border-border rounded-xl border p-3', !coupon.isActive && 'border-dashed')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                coupon.isActive ? 'bg-success' : 'bg-muted-foreground',
              )}
              aria-hidden="true"
            />
            <span className="font-mono text-sm font-semibold tracking-wide">{coupon.code}</span>
            {coupon.isPublic && (
              <Badge variant="secondary" className="text-[10px]">
                En la web
              </Badge>
            )}
            {/* Un cupón activo pero agotado o vencido se ve igual que uno que
              sirve: el operador lo dicta por teléfono y recién ahí se entera.
              El motor ya lo rechaza; esto es que se vea antes. */}
            {coupon.isActive && exhausted && (
              <Badge variant="outline" className="text-[10px]">
                Agotado
              </Badge>
            )}
            {coupon.isActive && expired && (
              <Badge variant="outline" className="text-[10px]">
                Vencido
              </Badge>
            )}
          </div>
          <p className="text-sm">{describeCouponBenefit(coupon)}</p>
          {coupon.description && (
            <p className="text-muted-foreground truncate text-xs">{coupon.description}</p>
          )}
          <p className="text-muted-foreground text-xs">
            {usage} · máx. {coupon.perCustomerLimit} por cliente
            {/* `timeZone` explícito: el cupón vence a las 23:59 de Paine, que en
              UTC ya es el día siguiente. Sin esto el panel anunciaría un día
              más del que el motor va a aceptar. */}
            {coupon.endsAt !== null &&
              ` · hasta el ${coupon.endsAt.toLocaleDateString('es-CL', {
                day: 'numeric',
                month: 'short',
                timeZone: SHOP_TIME_ZONE,
              })}`}
          </p>
        </div>

        <AdminForm
          feedback="toast"
          action={setCouponActiveAction.bind(null, coupon.id, !coupon.isActive)}
        >
          <AdminSubmit
            variant="outline"
            pendingLabel="…"
            className="h-11 shrink-0 px-3"
            aria-label={`${coupon.isActive ? 'Desactivar' : 'Activar'} el cupón ${coupon.code}`}
          >
            {coupon.isActive ? 'Desactivar' : 'Activar'}
          </AdminSubmit>
        </AdminForm>
      </div>

      {/* Nativo, cero JS: el operador lo abre para corregir un typo o un tope
          sin desactivar el cupón y crear uno nuevo. */}
      <details className="mt-2">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer py-1 text-xs font-medium select-none">
          Editar
        </summary>
        <AdminForm
          feedback="toast"
          action={updateCouponAction.bind(null, coupon.id)}
          className="mt-3 space-y-3"
        >
          <CouponFields coupon={coupon} />
          <AdminSubmit className="h-11 w-full sm:w-auto sm:px-8">Guardar cambios</AdminSubmit>
        </AdminForm>
      </details>
    </div>
  );
}
