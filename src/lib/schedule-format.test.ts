import { describe, expect, it } from 'vitest';
import { formatShifts } from './schedule-format';
import type { ScheduleSlot } from '@/server/services/schedule.service';

function slot(opensAt: string, closesAt: string): ScheduleSlot {
  return { opensAt, closesAt };
}

describe('formatShifts', () => {
  it('formats a single shift', () => {
    expect(formatShifts([slot('12:30', '15:00')])).toBe('12:30 – 15:00');
  });

  it('joins two shifts with "y"', () => {
    expect(formatShifts([slot('12:30', '15:00'), slot('18:00', '22:00')])).toBe(
      '12:30 – 15:00 y 18:00 – 22:00',
    );
  });

  it('returns an empty string for a day with no shifts', () => {
    expect(formatShifts([])).toBe('');
  });

  it('joins three or more shifts, all with the same "y"', () => {
    expect(
      formatShifts([slot('08:00', '10:00'), slot('12:00', '14:00'), slot('18:00', '22:00')]),
    ).toBe('08:00 – 10:00 y 12:00 – 14:00 y 18:00 – 22:00');
  });
});
