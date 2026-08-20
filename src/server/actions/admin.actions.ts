'use server';

import { revalidatePath } from 'next/cache';

import {
  assertAdmin,
  createAdminSession,
  clearAdminSession,
  verifyAdminPassword,
} from '@/lib/auth/admin-session';
import { ErrorCode } from '@/lib/errors';
import { parseMoney } from '@/lib/money';
import { fail, failFrom, ok, type ActionResult } from '@/lib/result';
import { communeRepository, settingsRepository } from '@/server/repositories/operations.repository';
import { productRepository } from '@/server/repositories/product.repository';
import { updateCommunesSchema } from '@/schemas/commune.schema';
import { businessHoursSchema } from '@/schemas/schedule.schema';
import { updateBusinessHours } from '@/server/services/schedule.service';

/**
 * Todas las acciones del panel devuelven `ActionResult<string>`, donde el dato
 * es el texto que se le muestra al operador.
 *
 * Antes devolvían `void` y lanzaban: un zod inválido subía al error boundary de
 * Next y un guardado correcto no se distinguía de uno que no llegó a pasar. En
 * un local abierto eso se paga apretando «Guardar» de nuevo, sin saber si el
 * primero entró. El error se modela como dato porque una Server Action sólo
 * puede devolver valores serializables.
 *
 * La firma `(state, formData)` es la que pide `useActionState`; las acciones con
 * argumento propio lo reciben antes y se atan con `.bind()`.
 */
type AdminResult = ActionResult<string>;

export async function loginAction(_state: AdminResult | null, formData: FormData) {
  const password = String(formData.get('password') ?? '');

  // Una contraseña equivocada volvía a pintar el mismo formulario vacío, sin
  // decir nada: era indistinguible de un error de red.
  if (!verifyAdminPassword(password)) {
    return fail('Contraseña incorrecta.', ErrorCode.UNAUTHENTICATED);
  }

  await createAdminSession();
  revalidatePath('/admin');
  return ok('Sesión iniciada.');
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  revalidatePath('/admin');
}

export async function toggleAcceptingOrdersAction(
  acceptingOrders: boolean,
  _state: AdminResult | null,
  _formData: FormData,
) {
  try {
    await assertAdmin();
    await settingsRepository.update({ acceptingOrders });
    revalidatePath('/admin');
    revalidatePath('/');
    return ok(acceptingOrders ? 'Negocio abierto.' : 'Negocio cerrado.');
  } catch (error) {
    return failFrom(error);
  }
}

export async function toggleDeliveryAction(
  deliveryEnabled: boolean,
  _state: AdminResult | null,
  _formData: FormData,
) {
  try {
    await assertAdmin();
    await settingsRepository.update({ deliveryEnabled });
    revalidatePath('/admin');
    revalidatePath('/');
    return ok(deliveryEnabled ? 'Delivery activado.' : 'Delivery desactivado.');
  } catch (error) {
    return failFrom(error);
  }
}

export async function setProductAvailabilityAction(
  productId: string,
  available: boolean,
  _state: AdminResult | null,
  _formData: FormData,
) {
  try {
    await assertAdmin();
    await productRepository.setAvailability(productId, available ? 'AVAILABLE' : 'OUT_OF_STOCK');
    revalidatePath('/admin');
    revalidatePath('/');
    return ok(available ? 'Producto disponible.' : 'Producto agotado.');
  } catch (error) {
    return failFrom(error);
  }
}

export async function setProductFeaturedAction(
  productId: string,
  isFeatured: boolean,
  _state: AdminResult | null,
  _formData: FormData,
) {
  try {
    await assertAdmin();
    await productRepository.setFeatured(productId, isFeatured);
    revalidatePath('/admin');
    revalidatePath('/');
    return ok(isFeatured ? 'Destacado en la portada.' : 'Quitado de destacados.');
  } catch (error) {
    return failFrom(error);
  }
}

export async function updateBusinessHoursAction(_state: AdminResult | null, formData: FormData) {
  try {
    await assertAdmin();

    const dayOfWeekMap = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ] as const;

    // Arrancar con los 7 días en null y llenarlos desde el form: el array
    // siempre tiene largo 7, que es lo que exige `businessHoursSchema.length(7)`.
    type HourField = 'opensAt' | 'closesAt' | 'opensAt2' | 'closesAt2';
    const days: Record<
      number,
      { dayOfWeek: (typeof dayOfWeekMap)[number] } & Record<HourField, string | null>
    > = {};
    dayOfWeekMap.forEach((dayOfWeek, dayNum) => {
      days[dayNum] = { dayOfWeek, opensAt: null, closesAt: null, opensAt2: null, closesAt2: null };
    });

    // `<día>_<turno>_<campo>`: el turno va en el name porque el día tiene dos
    // (12:30–15:00 y 18:00–22:00) y `formData` es plana. El sufijo `2` de la
    // columna se arma acá; el form solo numera turnos.
    for (const [key, value] of formData.entries()) {
      const match = key.match(/^(\d+)_(1|2)_(opensAt|closesAt)$/);
      if (match && match[1] && match[2] && match[3]) {
        const dayNum = Number(match[1]);
        const field = (match[2] === '2' ? `${match[3]}2` : match[3]) as HourField;
        const day = days[dayNum];
        // Un input vacío es `''`: `String(value || null)` daba la *cadena*
        // `'null'` y reventaba el regex de zod. Vacío significa sin hora.
        if (day) day[field] = value ? String(value) : null;
      }
    }

    // La casilla «Cerrado» manda sobre las horas: un checkbox sin marcar no se
    // envía, así que su ausencia es lo que abre el día. Y si el día queda abierto
    // pero le falta una de las dos horas, se cierra igual — ante la duda, cerrado.
    for (const [dayNumStr, day] of Object.entries(days)) {
      const isClosed = formData.get(`${dayNumStr}_closed`) !== null;
      if (isClosed || !day.opensAt || !day.closesAt) {
        day.opensAt = null;
        day.closesAt = null;
        day.opensAt2 = null;
        day.closesAt2 = null;
        continue;
      }

      // Medio segundo turno no cierra el día: se descarta el turno y el primero
      // queda en pie. Un turno partido a medio llenar no puede dejar al local
      // publicado como cerrado de lunes a sábado.
      if (!day.opensAt2 || !day.closesAt2) {
        day.opensAt2 = null;
        day.closesAt2 = null;
      }
    }

    const parsed = businessHoursSchema.safeParse(Object.values(days));
    if (!parsed.success) {
      return fail('No se pudieron guardar los horarios: revisa las horas.', ErrorCode.VALIDATION);
    }

    await updateBusinessHours(parsed.data);

    revalidatePath('/admin');
    revalidatePath('/');
    return ok('Horarios guardados.');
  } catch (error) {
    return failFrom(error);
  }
}

/**
 * Lets the operator retune the delivery bands without a deploy — fuel goes up,
 * the fees follow the same day. The whole table is submitted at once because
 * the zones are read against each other: nobody adjusts Champa without looking
 * at Hospital.
 */
export async function updateCommunesAction(_state: AdminResult | null, formData: FormData) {
  try {
    await assertAdmin();

    // `ids` carries the row set, so a zone whose checkbox is unticked still gets
    // written as inactive. Reading the keys instead would silently skip it —
    // an unchecked checkbox is simply absent from the FormData.
    const ids = formData.getAll('zoneId').map(String);

    const input = ids.map((id) => ({
      id,
      deliveryFeeMin: parseMoney(String(formData.get(`${id}_min`) ?? '')),
      deliveryFeeMax: parseMoney(String(formData.get(`${id}_max`) ?? '')),
      extraMinutes: Number.parseInt(String(formData.get(`${id}_minutes`) ?? '0'), 10) || 0,
      isActive: formData.get(`${id}_active`) !== null,
    }));

    const parsed = updateCommunesSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        'No se pudieron guardar las zonas: el mínimo no puede ser mayor que el máximo.',
        ErrorCode.VALIDATION,
      );
    }

    for (const zone of parsed.data) {
      await communeRepository.update(zone.id, {
        deliveryFeeMin: zone.deliveryFeeMin,
        deliveryFeeMax: zone.deliveryFeeMax,
        // The charged fee is the low end of the band. Kept in sync here so the
        // panel never leaves `pricing.service` charging a figure the operator
        // does not see on screen.
        deliveryFee: zone.deliveryFeeMin,
        extraMinutes: zone.extraMinutes,
        isActive: zone.isActive,
      });
    }

    revalidatePath('/admin');
    revalidatePath('/');
    const count = parsed.data.length;
    return ok(`Zonas guardadas (${count}).`);
  } catch (error) {
    return failFrom(error);
  }
}
