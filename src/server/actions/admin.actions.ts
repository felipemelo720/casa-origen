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

  // Start from all 7 days as closed: a closed day renders no <input> in the
  // form (nothing to edit), so it never shows up in `formData.entries()`.
  // Building the array only from what's submitted left it short of 7
  // whenever any day was closed, and `businessHoursSchema.length(7)` threw
  // an uncaught ZodError — every save crashed with a 500 on a week that had
  // a closed day, which is the normal case here (Monday).
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
      if (days[dayNum]) {
        days[dayNum][field as 'opensAt' | 'closesAt'] = String(value || null);
      }
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
