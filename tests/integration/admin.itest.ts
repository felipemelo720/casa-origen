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
 */
function buildHoursForm(options: { mondayClosed: boolean }): FormData {
  const formData = new FormData();

  for (let day = 0; day < 7; day += 1) {
    formData.set(`${day}_opensAt`, '12:00');
    formData.set(`${day}_closesAt`, '23:00');
    if (day !== MONDAY) formData.set(`${day}_closed`, 'on');
  }

  if (options.mondayClosed) formData.set(`${MONDAY}_closed`, 'on');

  return formData;
}

describe('updateBusinessHoursAction (integración)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rechaza sin la cookie de admin', async () => {
    await expect(
      updateBusinessHoursAction(buildHoursForm({ mondayClosed: false })),
    ).rejects.toThrow();
    expect(await prisma.businessHour.count()).toBe(0);
  });

  it('abre un día cerrado', async () => {
    await signInAsAdmin();

    await updateBusinessHoursAction(buildHoursForm({ mondayClosed: false }));

    const monday = await prisma.businessHour.findUniqueOrThrow({ where: { dayOfWeek: MONDAY } });
    expect(monday.isClosed).toBe(false);
    // Minutos desde medianoche: 12:00 y 23:00.
    expect(monday.opensAt).toBe(720);
    expect(monday.closesAt).toBe(1380);
  });

  it('cierra un día abierto', async () => {
    await signInAsAdmin();

    await updateBusinessHoursAction(buildHoursForm({ mondayClosed: false }));
    await updateBusinessHoursAction(buildHoursForm({ mondayClosed: true }));

    const monday = await prisma.businessHour.findUniqueOrThrow({ where: { dayOfWeek: MONDAY } });
    expect(monday.isClosed).toBe(true);
    expect(monday.opensAt).toBe(0);
  });
});
