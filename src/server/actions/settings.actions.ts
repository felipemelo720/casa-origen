'use server';

import { revalidatePath } from 'next/cache';

import { permissionAction } from '@/server/actions/action-builder';
import { settingsRepository } from '@/server/repositories/operations.repository';
import { settingsSchema } from '@/schemas/settings.schema';
import { permission } from '@/constants/permissions';

export const updateSettingsAction = permissionAction(
  { name: 'settings.update', permissions: [permission('setting', 'update')] },
  settingsSchema,
  async (input) => {
    await settingsRepository.update({
      name: input.name,
      tagline: input.tagline || null,
      description: input.description || null,
      email: input.email || null,
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
      address: input.address || null,
      instagramUrl: input.instagramUrl || null,
      facebookUrl: input.facebookUrl || null,
      acceptingOrders: input.acceptingOrders,
      closedMessage: input.closedMessage || null,
      defaultDeliveryFee: input.defaultDeliveryFee,
      freeDeliveryFrom: input.freeDeliveryFrom,
      minOrderAmount: input.minOrderAmount,
      deliveryEtaMinutes: input.deliveryEtaMinutes,
      pickupEtaMinutes: input.pickupEtaMinutes,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
    });

    revalidatePath('/', 'layout');
    return { ok: true };
  },
);
