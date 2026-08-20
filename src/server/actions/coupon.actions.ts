'use server';

import { revalidatePath } from 'next/cache';

import { assertAdmin } from '@/lib/auth/admin-session';
import { ConflictError, ErrorCode } from '@/lib/errors';
import { parseMoney } from '@/lib/money';
import { fail, failFrom, ok, type ActionResult } from '@/lib/result';
import { couponRepository } from '@/server/repositories/promotion.repository';
import { SHOP_TIME_ZONE } from '@/server/services/schedule.service';
import { createCouponSchema } from '@/schemas/coupon.schema';

type AdminResult = ActionResult<string>;

/**
 * Fin del día `YYYY-MM-DD` en hora de Paine, como instante UTC.
 *
 * El proceso corre en UTC (`TZ` no está fijado en pm2), así que
 * `new Date('2026-08-20T23:59:59')` sería las 19:59 de Santiago: un cupón que
 * el panel anuncia hasta el 20 moriría a media tarde. Se resuelve explícito por
 * el mismo motivo que el día de la semana en `schedule.service` — el env var es
 * segunda línea de defensa, no la primera.
 */
function endOfDayInShopTime(isoDate: string): Date {
  const naive = new Date(`${isoDate}T23:59:59Z`);
  const asShop = new Date(naive.toLocaleString('en-US', { timeZone: SHOP_TIME_ZONE }));
  const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(naive.getTime() - (asShop.getTime() - asUtc.getTime()));
}

/** Una casilla sin marcar no viaja en el `FormData`: su ausencia es `false`. */
function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) !== null;
}

/** Campo numérico opcional: vacío es «sin límite», no cero. */
function optionalInt(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  if (raw === '') return null;
  const parsed = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Monto opcional en pesos. `parseMoney('')` es 0, que acá significaría un tope de $0. */
function optionalMoney(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  return raw === '' ? null : parseMoney(raw);
}

/**
 * Parseo común a alta y edición: valor según tipo (un 10 en porcentaje son 10
 * puntos, un 10.000 en monto fijo son 10.000 pesos — `parseMoney` tira los
 * separadores de miles, que es justo lo que un porcentaje no debe tener) y
 * `endsAt` resuelto a fin de día en hora de Paine.
 */
function parseCouponForm(formData: FormData) {
  const discountType = String(formData.get('discountType') ?? '');
  const rawValue = String(formData.get('value') ?? '');
  const value =
    discountType === 'PERCENTAGE'
      ? Number.parseInt(rawValue.replace(/[^\d]/g, ''), 10) || 0
      : parseMoney(rawValue);

  const rawEndsAt = String(formData.get('endsAt') ?? '').trim();

  return createCouponSchema.safeParse({
    code: String(formData.get('code') ?? ''),
    description: String(formData.get('description') ?? '').trim() || undefined,
    discountType,
    value,
    minSubtotal: parseMoney(String(formData.get('minSubtotal') ?? '')),
    maxDiscount: optionalMoney(formData, 'maxDiscount'),
    usageLimit: optionalInt(formData, 'usageLimit'),
    perCustomerLimit: optionalInt(formData, 'perCustomerLimit') ?? 1,
    freeDelivery: checkbox(formData, 'freeDelivery'),
    isActive: checkbox(formData, 'isActive'),
    isPublic: checkbox(formData, 'isPublic'),
    // `<input type="date">` entrega `YYYY-MM-DD`. «Vence el 20» tiene que ser
    // el 20 completo en Paine, no hasta media tarde.
    endsAt: rawEndsAt === '' ? null : endOfDayInShopTime(rawEndsAt),
  });
}

export async function createCouponAction(_state: AdminResult | null, formData: FormData) {
  try {
    await assertAdmin();

    const parsed = parseCouponForm(formData);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(first?.message ?? 'Revisa los datos del cupón.', ErrorCode.VALIDATION);
    }

    // Chequeo previo para poder decir *cuál* código está tomado. El índice único
    // de la tabla sigue siendo la garantía real; esto es el mensaje.
    const existing = await couponRepository.findByCode(parsed.data.code);
    if (existing) {
      throw new ConflictError(`El código ${parsed.data.code} ya existe.`);
    }

    await couponRepository.createFromAdmin(parsed.data);

    revalidatePath('/admin');
    revalidatePath('/');
    return ok(`Cupón ${parsed.data.code} creado.`);
  } catch (error) {
    return failFrom(error);
  }
}

export async function updateCouponAction(
  couponId: string,
  _state: AdminResult | null,
  formData: FormData,
) {
  try {
    await assertAdmin();

    const parsed = parseCouponForm(formData);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(first?.message ?? 'Revisa los datos del cupón.', ErrorCode.VALIDATION);
    }

    // El código puede coincidir con el propio cupón (no se tocó, o se guardó
    // igual): sólo es conflicto si le pertenece a otra fila.
    const existing = await couponRepository.findByCode(parsed.data.code);
    if (existing && existing.id !== couponId) {
      throw new ConflictError(`El código ${parsed.data.code} ya existe.`);
    }

    const updated = await couponRepository.updateFromAdmin(couponId, parsed.data);

    revalidatePath('/admin');
    revalidatePath('/');
    return ok(`Cupón ${updated.code} actualizado.`);
  } catch (error) {
    return failFrom(error);
  }
}

export async function setCouponActiveAction(
  couponId: string,
  isActive: boolean,
  _state: AdminResult | null,
  _formData: FormData,
) {
  try {
    await assertAdmin();
    const coupon = await couponRepository.setActive(couponId, isActive);
    revalidatePath('/admin');
    revalidatePath('/');
    return ok(isActive ? `Cupón ${coupon.code} activado.` : `Cupón ${coupon.code} desactivado.`);
  } catch (error) {
    return failFrom(error);
  }
}
