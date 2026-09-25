import { beforeEach, describe, expect, it } from 'vitest';

import { env } from '@/config/env';
import { buildFaq } from '@/features/storefront/faq-content';
import { prisma } from '@/lib/db/prisma';
import { deriveAdminSessionToken } from '@/lib/security/session-token';
import { toggleDeliveryAction, updateCommunesAction } from '@/server/actions/admin.actions';
import {
  communeRepository,
  paymentMethodRepository,
  settingsRepository,
} from '@/server/repositories/operations.repository';
import { getWeeklySchedule } from '@/server/services/schedule.service';

import { resetDb } from '../setup/db';
import { setCookie } from '../setup/request-context';

async function signInAsAdmin(): Promise<void> {
  setCookie('admin_session', await deriveAdminSessionToken(env.ADMIN_PASSWORD));
}

/** Las mismas consultas y el mismo armado que hace el home. */
async function faqFromDb() {
  const [settings, zones, schedule, paymentMethods] = await Promise.all([
    settingsRepository.get(),
    communeRepository.findAllActive(),
    getWeeklySchedule(),
    paymentMethodRepository.findAllActive(),
  ]);

  return buildFaq({
    deliveryEnabled: settings.deliveryEnabled,
    freeDeliveryFrom: settings.freeDeliveryFrom,
    zones,
    schedule,
    paymentMethods: paymentMethods.map((method) => method.name),
  });
}

function answerTo(items: Awaited<ReturnType<typeof faqFromDb>>, question: string) {
  return items.find((item) => item.question === question)?.answer;
}

describe('FAQ del home (integración)', () => {
  beforeEach(async () => {
    await resetDb();
    // Ni comunas ni medios de pago los toca `resetDb`: se devuelven al seed.
    await prisma.commune.update({
      where: { slug: 'paine-centro' },
      data: { deliveryFee: 2000, deliveryFeeMin: 2000, deliveryFeeMax: 3000, isActive: true },
    });
    await prisma.paymentMethod.updateMany({
      where: { code: { in: ['TRANSFER', 'CASH'] } },
      data: { isActive: true },
    });
  });

  it('responde con las zonas y los medios de pago sembrados', async () => {
    const items = await faqFromDb();

    expect(answerTo(items, '¿Llegan a mi sector?')).toContain('Paine Centro');
    expect(answerTo(items, '¿Cómo puedo pagar?')).toBe('Transferencia o efectivo.');
  });

  it('deja de ofrecer una zona que el admin apagó', async () => {
    await signInAsAdmin();
    const zone = await prisma.commune.findUniqueOrThrow({ where: { slug: 'paine-centro' } });

    const result = await updateCommunesAction(null, zoneForm(zone.id));
    expect(result.ok).toBe(true);

    expect(answerTo(await faqFromDb(), '¿Llegan a mi sector?')).not.toContain('Paine Centro');
  });

  it('no promete despacho con el delivery apagado desde el panel', async () => {
    await signInAsAdmin();

    const result = await toggleDeliveryAction(false, null, new FormData());
    expect(result.ok).toBe(true);

    const items = await faqFromDb();
    expect(answerTo(items, '¿Llegan a mi sector?')).toBeUndefined();
    expect(answerTo(items, '¿Cuánto cuesta el despacho?')).toBeUndefined();
    expect(answerTo(items, '¿Hacen despacho?')).toMatch(/pausado/);
  });

  it('nombra solo los medios de pago activos', async () => {
    await prisma.paymentMethod.update({ where: { code: 'CASH' }, data: { isActive: false } });

    expect(answerTo(await faqFromDb(), '¿Cómo puedo pagar?')).toBe('Transferencia.');
  });

  it('omite el horario si no hay ningún día cargado', async () => {
    // `resetDb` trunca `business_hours`: la semana queda entera cerrada.
    expect(answerTo(await faqFromDb(), '¿Cuál es el horario?')).toBeUndefined();
  });
});

/** Una sola zona en el form, sin `<id>_active`: así manda el panel una zona apagada. */
function zoneForm(zoneId: string): FormData {
  const formData = new FormData();
  formData.append('zoneId', zoneId);
  formData.set(`${zoneId}_min`, '$2.000');
  formData.set(`${zoneId}_max`, '$3.000');
  formData.set(`${zoneId}_minutes`, '0');
  return formData;
}
