import 'server-only';

import { businessHourRepository } from '@/server/repositories/operations.repository';
import { scheduleRepository } from '@/server/repositories/schedule.repository';
import { settingsRepository } from '@/server/repositories/operations.repository';
import type { BusinessHoursInput } from '@/schemas/schedule.schema';
import { logger } from '@/lib/logger';

export type OpenState = {
  isOpen: boolean;
  reason?: string;
};

/** One shift of a day. `HH:mm`, already formatted; the minutes stay server-side. */
export type ScheduleSlot = {
  opensAt: string;
  closesAt: string;
};

export type ScheduleDay = {
  /** 0 = Sunday … 6 = Saturday, matching `Date#getDay`. */
  dayOfWeek: number;
  label: string;
  isClosed: boolean;
  /**
   * The day's shifts in order — one, or two when the kitchen closes at 15:00
   * and reopens at 18:00. Empty on a closed day.
   */
  slots: ScheduleSlot[];
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
 * The shop is in Paine; the box it runs on is UTC.
 *
 * `Date#getDay()` answers with the *server's* day. Chile is UTC-4, so from
 * 20:00 local onwards the server is already on tomorrow — the header would
 * advertise tomorrow's hours during the dinner rush, and on a Sunday night it
 * would read Monday's closed row and claim there is no schedule while the shop
 * is open. Setting `TZ` on the process fixes it too, but silently and only
 * until someone starts the app without it, so the day is resolved explicitly
 * here and the env var is only a second line of defence.
 */
export const SHOP_TIME_ZONE = 'America/Santiago';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const shopWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TIME_ZONE,
  weekday: 'short',
});

/** `Date#getDay()`, but in the shop's timezone instead of the server's. */
export function dayOfWeekInShopTime(now: Date): number {
  const weekday = shopWeekdayFormatter.format(now);
  const index = WEEKDAY_INDEX[weekday];

  if (index === undefined) {
    // Unreachable with a full-ICU Node ('en-US' short weekdays are fixed), but
    // the failure this guards against is a *silently* wrong day, so it gets
    // logged rather than swallowed before falling back to the server's clock.
    logger.error({ weekday, timeZone: SHOP_TIME_ZONE }, 'Unrecognised weekday from Intl');
    return now.getDay();
  }

  return index;
}

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
  const today = dayOfWeekInShopTime(now);

  return WEEK_ORDER.map((dayOfWeek) => {
    const day = hours.find((h) => h.dayOfWeek === dayOfWeek);
    const isClosed = day?.isClosed ?? true;
    const slots: ScheduleSlot[] = [];

    if (day && !isClosed) {
      slots.push({
        opensAt: minutesToLocalTime(day.opensAt),
        closesAt: minutesToLocalTime(day.closesAt),
      });

      // Media franja no es una franja: sin las dos horas no hay segundo turno.
      // Se pregunta por `number` y no por `!== null` a propósito: con el Prisma
      // Client viejo en memoria (migrar con el dev encendido) las columnas
      // nuevas llegan `undefined`, que pasaba el chequeo y publicaba «NaN:NaN».
      if (typeof day.opensAt2 === 'number' && typeof day.closesAt2 === 'number') {
        slots.push({
          opensAt: minutesToLocalTime(day.opensAt2),
          closesAt: minutesToLocalTime(day.closesAt2),
        });
      }
    }

    return {
      dayOfWeek,
      label: DAY_LABELS[dayOfWeek] ?? '',
      isClosed,
      slots,
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
