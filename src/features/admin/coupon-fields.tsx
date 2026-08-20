import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { SHOP_TIME_ZONE } from '@/server/services/schedule.service';
import { formatMoney } from '@/lib/money';

type CouponFieldsValues = {
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED' | 'BUNDLE_PRICE';
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  freeDelivery: boolean;
  isActive: boolean;
  isPublic: boolean;
  endsAt: Date | null;
};

/**
 * `YYYY-MM-DD` en hora de Paine, lo que espera un `<input type="date">`.
 * Inverso de `endOfDayInShopTime` en `coupon.actions.ts`: el cupón vence a
 * las 23:59 de Paine, que en UTC ya puede ser el día siguiente, así que
 * volcar el `Date` guardado con la timezone del server adelantaría el
 * formulario un día.
 */
function toShopDateInputValue(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE }).format(date);
}

/**
 * Campos de un cupón, para alta y edición. Pensado para 360px: una columna en
 * el teléfono, dos desde `sm`, todo con 44px de alto.
 *
 * Server component y `<select>` nativo a propósito. El `Select` de Radix es
 * cliente y este formulario no tiene ni una interacción que lo justifique: sin
 * JS igual se envía, que es lo que uno quiere del panel de un local abierto.
 */
export function CouponFields({ coupon }: { coupon?: CouponFieldsValues }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código" hint="Sin espacios. Es lo que se dicta por teléfono.">
          <Input
            name="code"
            required
            maxLength={40}
            autoCapitalize="characters"
            placeholder="MARTES20"
            defaultValue={coupon?.code}
            className="h-11 font-mono tracking-wide uppercase"
          />
        </Field>

        <Field label="Descripción" hint="Opcional. Para acordarse de para qué era.">
          <Input
            name="description"
            maxLength={120}
            placeholder="20% los martes"
            defaultValue={coupon?.description ?? undefined}
            className="h-11"
          />
        </Field>

        <Field label="Tipo">
          <select
            name="discountType"
            defaultValue={coupon?.discountType ?? 'PERCENTAGE'}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-11 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
          >
            <option value="PERCENTAGE">Porcentaje</option>
            <option value="FIXED">Monto fijo</option>
          </select>
        </Field>

        <Field label="Valor" hint="Porcentaje de 1 a 100, o el monto en pesos.">
          <Input
            name="value"
            inputMode="numeric"
            placeholder="20"
            defaultValue={
              coupon
                ? coupon.discountType === 'PERCENTAGE'
                  ? String(coupon.value)
                  : formatMoney(coupon.value)
                : undefined
            }
            className="h-11"
          />
        </Field>

        <Field label="Compra mínima" hint="Vacío o 0 = sin mínimo.">
          <Input
            name="minSubtotal"
            inputMode="numeric"
            placeholder="0"
            defaultValue={
              coupon && coupon.minSubtotal > 0 ? formatMoney(coupon.minSubtotal) : undefined
            }
            className="h-11"
          />
        </Field>

        <Field label="Tope de descuento" hint="Sólo para porcentaje. Vacío = sin tope.">
          <Input
            name="maxDiscount"
            inputMode="numeric"
            placeholder="6.000"
            defaultValue={coupon?.maxDiscount ? formatMoney(coupon.maxDiscount) : undefined}
            className="h-11"
          />
        </Field>

        <Field label="Usos totales" hint="Vacío = ilimitado.">
          <Input
            name="usageLimit"
            inputMode="numeric"
            placeholder="Ilimitado"
            defaultValue={coupon?.usageLimit ?? undefined}
            className="h-11"
          />
        </Field>

        <Field label="Usos por cliente" hint="Sólo cuenta a clientes con cuenta.">
          <Input
            name="perCustomerLimit"
            inputMode="numeric"
            defaultValue={coupon ? coupon.perCustomerLimit : 1}
            className="h-11"
          />
        </Field>

        <Field label="Vence" hint="Opcional. El último día cuenta completo.">
          <Input
            name="endsAt"
            type="date"
            defaultValue={coupon?.endsAt ? toShopDateInputValue(coupon.endsAt) : undefined}
            className="h-11"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Toggle name="freeDelivery" label="Envío gratis" defaultChecked={coupon?.freeDelivery} />
        <Toggle name="isPublic" label="Mostrar en la web" defaultChecked={coupon?.isPublic} />
        <Toggle name="isActive" label="Activo" defaultChecked={coupon ? coupon.isActive : true} />
      </div>
    </div>
  );
}

/** Alta desde cero: mismos campos, sin valores previos. */
export function NewCouponFields() {
  return <CouponFields />;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-muted-foreground/70 block text-[10px] tracking-widest uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="text-muted-foreground flex h-11 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none"
      />
      {label}
    </label>
  );
}
