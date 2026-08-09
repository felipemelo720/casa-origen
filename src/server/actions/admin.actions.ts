'use server';

import { revalidatePath } from 'next/cache';

import {
  createAdminSession,
  clearAdminSession,
  verifyAdminPassword,
  isAdminAuthenticated,
} from '@/lib/auth/admin-session';
import { ForbiddenError } from '@/lib/errors';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { productRepository } from '@/server/repositories/product.repository';
import { businessHoursSchema } from '@/schemas/schedule.schema';
import { updateBusinessHours } from '@/server/services/schedule.service';

async function assertAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) throw new ForbiddenError();
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  if (verifyAdminPassword(password)) {
    await createAdminSession();
    revalidatePath('/admin');
  }
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  revalidatePath('/admin');
}

export async function toggleAcceptingOrdersAction(acceptingOrders: boolean): Promise<void> {
  await assertAdmin();
  await settingsRepository.update({ acceptingOrders });
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function toggleDeliveryAction(deliveryEnabled: boolean): Promise<void> {
  await assertAdmin();
  await settingsRepository.update({ deliveryEnabled });
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function setProductAvailabilityAction(
  productId: string,
  available: boolean,
): Promise<void> {
  await assertAdmin();
  await productRepository.setAvailability(productId, available ? 'AVAILABLE' : 'OUT_OF_STOCK');
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function setProductFeaturedAction(
  productId: string,
  isFeatured: boolean,
): Promise<void> {
  await assertAdmin();
  await productRepository.setFeatured(productId, isFeatured);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function updateBusinessHoursAction(formData: FormData): Promise<void> {
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
  const days: Record<
    number,
    { dayOfWeek: (typeof dayOfWeekMap)[number]; opensAt: string | null; closesAt: string | null }
  > = {};
  dayOfWeekMap.forEach((dayOfWeek, dayNum) => {
    days[dayNum] = { dayOfWeek, opensAt: null, closesAt: null };
  });

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^(\d+)_(opensAt|closesAt)$/);
    if (match && match[1] && match[2]) {
      const dayNum = Number(match[1]);
      const field = match[2];
      const day = days[dayNum];
      // Un input vacío es `''`: `String(value || null)` daba la *cadena*
      // `'null'` y reventaba el regex de zod. Vacío significa sin hora.
      if (day) day[field as 'opensAt' | 'closesAt'] = value ? String(value) : null;
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
    }
  }

  const input = Object.values(days);

  // Validate
  const validated = businessHoursSchema.parse(input);

  // Update
  await updateBusinessHours(validated);

  // Revalidate
  revalidatePath('/admin');
  revalidatePath('/');
}
