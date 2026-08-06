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

export async function setProductAvailabilityAction(productId: string, available: boolean): Promise<void> {
  await assertAdmin();
  await productRepository.setAvailability(productId, available ? 'AVAILABLE' : 'OUT_OF_STOCK');
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function setProductFeaturedAction(productId: string, isFeatured: boolean): Promise<void> {
  await assertAdmin();
  await productRepository.setFeatured(productId, isFeatured);
  revalidatePath('/admin');
  revalidatePath('/');
}
