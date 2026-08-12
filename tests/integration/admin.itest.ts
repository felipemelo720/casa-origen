import { beforeEach, describe, expect, it } from 'vitest';

import { env } from '@/config/env';
import { prisma } from '@/lib/db/prisma';
import { deriveAdminSessionToken } from '@/lib/security/session-token';
import { updateBusinessHoursAction } from '@/server/actions/admin.actions';

import { resetDb } from '../setup/db';
import { setCookie } from '../setup/request-context';

const MONDAY = 1;

async function signInAsAdmin(): Promise<void> {
  setCookie('admin_session', await deriveAdminSessionToken(env.ADMIN_PASSWORD));
}

/**
 * Arma el form como lo manda el panel: los 7 días siempre presentes, y la
 * casilla `<n>_closed` solo en los días cerrados — un checkbox sin marcar no
 * se envía, y esa ausencia es lo que abre el día.
 *
 * Los campos van como `<día>_<turno>_<campo>`: el día tiene dos turnos y
 * `FormData` es plana, así que el número de turno viaja en el `name`.
 */
function buildHoursForm(options: { mondayClosed: boolean; splitShift?: boolean }): FormData {
  const formData = new FormData();

  for (let day = 0; day < 7; day += 1) {
    if (options.splitShift) {
      formData.set(`${day}_1_opensAt`, '12:30');
      formData.set(`${day}_1_closesAt`, '15:00');
      formData.set(`${day}_2_opensAt`, '18:00');
      formData.set(`${day}_2_closesAt`, '22:00');
    } else {
      formData.set(`${day}_1_opensAt`, '12:00');
      formData.set(`${day}_1_closesAt`, '23:00');
    }
    if (day !== MONDAY) formData.set(`${day}_closed`, 'on');
  }

  if (options.mondayClosed) formData.set(`${MONDAY}_closed`, 'on');

  return formData;
}

describe('updateBusinessHoursAction (integración)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  // La acción ya no lanza: devuelve el error como dato para que el panel lo
  // pueda mostrar. Que no escriba nada sigue siendo lo que importa.
  it('rechaza sin la cookie de admin', async () => {
    const result = await updateBusinessHoursAction(null, buildHoursForm({ mondayClosed: false }));

    expect(result.ok).toBe(false);
    expect(await prisma.businessHour.count()).toBe(0);
  });

  it('abre un día cerrado', async () => {
    await signInAsAdmin();

    const result = await updateBusinessHoursAction(null, buildHoursForm({ mondayClosed: false }));

    // El mensaje es lo único que el operador ve al guardar, así que se prueba.
    expect(result).toEqual({ ok: true, data: 'Horarios guardados.' });

    const monday = await prisma.businessHour.findUniqueOrThrow({ where: { dayOfWeek: MONDAY } });
    expect(monday.isClosed).toBe(false);
    // Minutos desde medianoche: 12:00 y 23:00.
    expect(monday.opensAt).toBe(720);
    expect(monday.closesAt).toBe(1380);
    // Sin segundo turno en el form, las columnas quedan nulas y no en 0: un
    // turno que no existe no es un turno de medianoche a medianoche.
    expect(monday.opensAt2).toBeNull();
    expect(monday.closesAt2).toBeNull();
  });

  it('guarda el turno partido', async () => {
    await signInAsAdmin();

    const result = await updateBusinessHoursAction(
      null,
      buildHoursForm({ mondayClosed: false, splitShift: true }),
    );
    expect(result).toEqual({ ok: true, data: 'Horarios guardados.' });

    const monday = await prisma.businessHour.findUniqueOrThrow({ where: { dayOfWeek: MONDAY } });
    // 12:30–15:00 y 18:00–22:00, en minutos desde medianoche.
    expect(monday.opensAt).toBe(750);
    expect(monday.closesAt).toBe(900);
    expect(monday.opensAt2).toBe(1080);
    expect(monday.closesAt2).toBe(1320);
  });

  it('cierra un día abierto', async () => {
    await signInAsAdmin();

    await updateBusinessHoursAction(null, buildHoursForm({ mondayClosed: false }));
    await updateBusinessHoursAction(null, buildHoursForm({ mondayClosed: true }));

    const monday = await prisma.businessHour.findUniqueOrThrow({ where: { dayOfWeek: MONDAY } });
    expect(monday.isClosed).toBe(true);
    expect(monday.opensAt).toBe(0);
  });
});
