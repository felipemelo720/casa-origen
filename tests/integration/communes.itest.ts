import { beforeEach, describe, expect, it } from 'vitest';

import { env } from '@/config/env';
import { prisma } from '@/lib/db/prisma';
import { deriveAdminSessionToken } from '@/lib/security/session-token';
import { updateCommunesAction } from '@/server/actions/admin.actions';

import { resetDb } from '../setup/db';
import { setCookie } from '../setup/request-context';

async function signInAsAdmin(): Promise<void> {
  setCookie('admin_session', await deriveAdminSessionToken(env.ADMIN_PASSWORD));
}

/**
 * Arma el form como lo manda el panel: un `zoneId` por fila, los montos ya
 * formateados como los muestra el input, y `<id>_active` solo en las zonas
 * encendidas — un checkbox sin marcar no se envía.
 */
function buildZoneForm(
  zones: { id: string; min: string; max: string; minutes: string; active: boolean }[],
): FormData {
  const formData = new FormData();

  for (const zone of zones) {
    formData.append('zoneId', zone.id);
    formData.set(`${zone.id}_min`, zone.min);
    formData.set(`${zone.id}_max`, zone.max);
    formData.set(`${zone.id}_minutes`, zone.minutes);
    if (zone.active) formData.set(`${zone.id}_active`, 'on');
  }

  return formData;
}

async function zoneBySlug(slug: string) {
  return prisma.commune.findUniqueOrThrow({ where: { slug } });
}

describe('updateCommunesAction (integración)', () => {
  beforeEach(async () => {
    await resetDb();
    // `resetDb` no toca las comunas, así que las devuelve a lo que sembró el
    // seed antes de cada caso.
    await prisma.commune.update({
      where: { slug: 'paine-centro' },
      data: { deliveryFee: 2000, deliveryFeeMin: 2000, deliveryFeeMax: 3000, isActive: true },
    });
  });

  it('rechaza sin la cookie de admin', async () => {
    const zone = await zoneBySlug('paine-centro');

    await expect(
      updateCommunesAction(
        buildZoneForm([{ id: zone.id, min: '$9.000', max: '$9.000', minutes: '0', active: true }]),
      ),
    ).rejects.toThrow();

    expect((await zoneBySlug('paine-centro')).deliveryFeeMin).toBe(2000);
  });

  it('guarda la banda y deja el cobro en el mínimo', async () => {
    await signInAsAdmin();
    const zone = await zoneBySlug('paine-centro');

    await updateCommunesAction(
      buildZoneForm([{ id: zone.id, min: '$2.500', max: '$4.000', minutes: '5', active: true }]),
    );

    const updated = await zoneBySlug('paine-centro');
    expect(updated.deliveryFeeMin).toBe(2500);
    expect(updated.deliveryFeeMax).toBe(4000);
    // Lo que cobra `pricing.service` sigue el piso de la banda sin que el
    // operador tenga que saber que existe un tercer campo.
    expect(updated.deliveryFee).toBe(2500);
    expect(updated.extraMinutes).toBe(5);
  });

  it('rechaza una banda invertida sin escribir nada', async () => {
    await signInAsAdmin();
    const zone = await zoneBySlug('paine-centro');

    await expect(
      updateCommunesAction(
        buildZoneForm([{ id: zone.id, min: '$5.000', max: '$1.000', minutes: '0', active: true }]),
      ),
    ).rejects.toThrow();

    expect((await zoneBySlug('paine-centro')).deliveryFeeMin).toBe(2000);
  });

  it('apaga una zona cuya casilla no viene marcada', async () => {
    await signInAsAdmin();
    const zone = await zoneBySlug('paine-centro');

    await updateCommunesAction(
      buildZoneForm([{ id: zone.id, min: '$2.000', max: '$3.000', minutes: '0', active: false }]),
    );

    expect((await zoneBySlug('paine-centro')).isActive).toBe(false);
  });
});
