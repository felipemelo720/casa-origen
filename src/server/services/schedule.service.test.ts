import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/server/repositories/operations.repository', () => ({
  businessHourRepository: { findAll: vi.fn() },
  settingsRepository: { get: vi.fn() },
}));

vi.mock('@/server/repositories/schedule.repository', () => ({
  scheduleRepository: { upsertBusinessHours: vi.fn() },
}));

// `@/lib/logger` imports `@/config/env`, which throws unless the whole server
// env is present. The service only logs on an unreachable branch.
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { getOpenState, getWeeklySchedule, updateBusinessHours } from './schedule.service';
import {
  businessHourRepository,
  settingsRepository,
} from '@/server/repositories/operations.repository';
import { scheduleRepository } from '@/server/repositories/schedule.repository';

const findAllHours = vi.mocked(businessHourRepository.findAll);
const getSettings = vi.mocked(settingsRepository.get);
const upsertBusinessHours = vi.mocked(scheduleRepository.upsertBusinessHours);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getOpenState', () => {
  it('is open when acceptingOrders is true, no reason attached', async () => {
    getSettings.mockResolvedValue({ acceptingOrders: true } as never);
    const state = await getOpenState();
    expect(state).toEqual({ isOpen: true });
  });

  it('is closed with the admin-set message when acceptingOrders is false', async () => {
    getSettings.mockResolvedValue({
      acceptingOrders: false,
      closedMessage: 'Cerrado por mantención hasta las 18:00.',
    } as never);
    const state = await getOpenState();
    expect(state).toEqual({ isOpen: false, reason: 'Cerrado por mantención hasta las 18:00.' });
  });

  it('falls back to a default reason when closedMessage is unset', async () => {
    getSettings.mockResolvedValue({ acceptingOrders: false, closedMessage: null } as never);
    const state = await getOpenState();
    expect(state.isOpen).toBe(false);
    expect(state.reason).toBe('Estamos cerrados temporalmente.');
  });

  it('does not consult business_hours — acceptingOrders is the only gate', async () => {
    getSettings.mockResolvedValue({ acceptingOrders: true } as never);
    await getOpenState();
    expect(findAllHours).not.toHaveBeenCalled();
  });
});

describe('getWeeklySchedule', () => {
  it('always returns 7 rows, Monday first', async () => {
    findAllHours.mockResolvedValue([]);
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00')); // a Thursday
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('reports a day missing from business_hours as closed, not omitted', async () => {
    findAllHours.mockResolvedValue([]);
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00'));
    expect(week.every((d) => d.isClosed)).toBe(true);
  });

  it('formats stored minutes as HH:mm', async () => {
    findAllHours.mockResolvedValue([
      {
        dayOfWeek: 1,
        isClosed: false,
        opensAt: 570,
        closesAt: 1320,
        opensAt2: null,
        closesAt2: null,
      }, // 09:30–22:00
    ] as never);
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00'));
    const monday = week.find((d) => d.dayOfWeek === 1);
    expect(monday?.slots).toEqual([{ opensAt: '09:30', closesAt: '22:00' }]);
    expect(monday?.isClosed).toBe(false);
  });

  it('splits a day with a second shift into two slots', async () => {
    findAllHours.mockResolvedValue([
      // 12:30–15:00 y 18:00–22:00
      {
        dayOfWeek: 1,
        isClosed: false,
        opensAt: 750,
        closesAt: 900,
        opensAt2: 1080,
        closesAt2: 1320,
      },
    ] as never);
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00'));
    expect(week.find((d) => d.dayOfWeek === 1)?.slots).toEqual([
      { opensAt: '12:30', closesAt: '15:00' },
      { opensAt: '18:00', closesAt: '22:00' },
    ]);
  });

  it('ignores half a second shift', async () => {
    findAllHours.mockResolvedValue([
      {
        dayOfWeek: 1,
        isClosed: false,
        opensAt: 750,
        closesAt: 900,
        opensAt2: 1080,
        closesAt2: null,
      },
    ] as never);
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00'));
    expect(week.find((d) => d.dayOfWeek === 1)?.slots).toHaveLength(1);
  });

  it('ignores second-shift columns the Prisma Client does not know yet', async () => {
    // Migrar con el dev encendido deja el client viejo en memoria: las columnas
    // nuevas llegan `undefined`, no `null`, y el admin publicaba «NaN:NaN».
    findAllHours.mockResolvedValue([
      { dayOfWeek: 1, isClosed: false, opensAt: 750, closesAt: 900 },
    ] as never);
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00'));
    expect(week.find((d) => d.dayOfWeek === 1)?.slots).toEqual([
      { opensAt: '12:30', closesAt: '15:00' },
    ]);
  });

  it('leaves a closed day without slots', async () => {
    findAllHours.mockResolvedValue([
      {
        dayOfWeek: 1,
        isClosed: true,
        opensAt: 750,
        closesAt: 900,
        opensAt2: 1080,
        closesAt2: 1320,
      },
    ] as never);
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00'));
    expect(week.find((d) => d.dayOfWeek === 1)?.slots).toEqual([]);
  });

  it('flags only today as isToday', async () => {
    findAllHours.mockResolvedValue([]);
    // 2026-08-06 is a Thursday (dayOfWeek 4)
    const week = await getWeeklySchedule(new Date('2026-08-06T12:00:00-04:00'));
    expect(week.find((d) => d.isToday)?.dayOfWeek).toBe(4);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
  });

  it('resolves today in Santiago, not on the UTC server', async () => {
    findAllHours.mockResolvedValue([]);
    // 22:00 on a Friday in Paine is already Saturday 02:00 UTC. `getDay()` on
    // a UTC box answered 6, so every night from 20:00 the header advertised
    // the next day's hours — in the middle of the dinner rush.
    const week = await getWeeklySchedule(new Date('2026-08-08T02:00:00Z'));
    expect(week.find((d) => d.isToday)?.dayOfWeek).toBe(5);
  });

  it('still resolves the previous day on a Sunday night', async () => {
    findAllHours.mockResolvedValue([]);
    // Sunday 21:00 in Paine = Monday 01:00 UTC. Monday is the closed day, so
    // the old behaviour claimed "hoy sin horario publicado" with the shop open.
    const week = await getWeeklySchedule(new Date('2026-08-10T01:00:00Z'));
    expect(week.find((d) => d.isToday)?.dayOfWeek).toBe(0);
  });
});

describe('updateBusinessHours', () => {
  it('delegates straight to the repository', async () => {
    const days = [
      {
        dayOfWeek: 'MONDAY' as const,
        opensAt: '12:30',
        closesAt: '15:00',
        opensAt2: '18:00',
        closesAt2: '22:00',
      },
    ];
    upsertBusinessHours.mockResolvedValue([]);
    await updateBusinessHours(days);
    expect(upsertBusinessHours).toHaveBeenCalledWith(days);
  });
});
