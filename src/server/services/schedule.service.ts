import 'server-only';

import { businessHourRepository } from '@/server/repositories/operations.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';

export type OpenState = {
  isOpen: boolean;
  reason?: string;
  reopensAt?: string;
};

/**
 * Whether the restaurant can currently accept an order.
 *
 * Two independent switches: the manual `acceptingOrders` kill switch in the
 * settings singleton, and the weekly `business_hours` schedule. Both must
 * agree for the storefront to allow checkout.
 */
export async function getOpenState(now: Date = new Date()): Promise<OpenState> {
  const settings = await settingsRepository.get();

  if (!settings.acceptingOrders) {
    return { isOpen: false, reason: settings.closedMessage ?? 'Estamos cerrados temporalmente.' };
  }

  const hours = await businessHourRepository.findAll();
  const dayOfWeek = now.getDay();
  const today = hours.find((h) => h.dayOfWeek === dayOfWeek);

  if (!today || today.isClosed) {
    return { isOpen: false, reason: 'Hoy no estamos abiertos.' };
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes();

  if (minutesNow < today.opensAt) {
    return {
      isOpen: false,
      reason: 'Aún no abrimos.',
      reopensAt: minutesToLocalTime(today.opensAt),
    };
  }

  if (minutesNow > today.closesAt) {
    return { isOpen: false, reason: 'Ya cerramos por hoy.' };
  }

  return { isOpen: true };
}

function minutesToLocalTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
