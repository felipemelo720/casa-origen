import 'server-only';

import { businessHourRepository } from '@/server/repositories/operations.repository';
import { scheduleRepository } from '@/server/repositories/schedule.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';
import type { BusinessHoursInput } from '@/schemas/schedule.schema';

export type OpenState = {
  isOpen: boolean;
  reason?: string;
};

export type ScheduleDay = {
  /** 0 = Sunday … 6 = Saturday, matching `Date#getDay`. */
  dayOfWeek: number;
  label: string;
  isClosed: boolean;
  /** `HH:mm`, already formatted; the minutes stay server-side. */
  opensAt: string;
  closesAt: string;
  isToday: boolean;
};

const DAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** Monday first: how a customer reads a week, not how `getDay` numbers it. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Whether the restaurant can currently accept an order.
 *
 * The `acceptingOrders` switch in /admin decides on its own: flipping it open
 * opens the store even outside `business_hours`. The weekly schedule is what
 * the storefront advertises, not a second gate — a kitchen still working past
 * closing time should not have the checkout refuse orders it wants to take.
 *
 * The flip side: nothing closes the store automatically. Whoever opens it has
 * to close it.
 */
export async function getOpenState(): Promise<OpenState> {
  const settings = await settingsRepository.get();

  if (!settings.acceptingOrders) {
    return { isOpen: false, reason: settings.closedMessage ?? 'Estamos cerrados temporalmente.' };
  }

  return { isOpen: true };
}

/**
 * The full week, ready to render. Days missing from `business_hours` are
 * reported as closed rather than omitted, so the list always has seven rows.
 */
export async function getWeeklySchedule(now: Date = new Date()): Promise<ScheduleDay[]> {
  const hours = await businessHourRepository.findAll();
  const today = now.getDay();

  return WEEK_ORDER.map((dayOfWeek) => {
    const day = hours.find((h) => h.dayOfWeek === dayOfWeek);

    return {
      dayOfWeek,
      label: DAY_LABELS[dayOfWeek] ?? '',
      isClosed: day?.isClosed ?? true,
      opensAt: minutesToLocalTime(day?.opensAt ?? 0),
      closesAt: minutesToLocalTime(day?.closesAt ?? 0),
      isToday: dayOfWeek === today,
    };
  });
}

function minutesToLocalTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Update all 7 business hours. Called from admin action with validated input.
 */
export async function updateBusinessHours(days: BusinessHoursInput) {
  return scheduleRepository.upsertBusinessHours(days);
}
