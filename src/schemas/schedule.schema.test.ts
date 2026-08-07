import { describe, expect, it } from 'vitest';
import { businessHoursDaySchema, businessHoursSchema } from './schedule.schema';

function day(overrides: Record<string, unknown> = {}) {
  return { dayOfWeek: 'MONDAY', opensAt: '09:00', closesAt: '18:00', ...overrides };
}

describe('businessHoursDaySchema', () => {
  it('accepts a valid day', () => {
    expect(businessHoursDaySchema.safeParse(day()).success).toBe(true);
  });

  it('accepts null hours for a closed day', () => {
    expect(businessHoursDaySchema.safeParse(day({ opensAt: null, closesAt: null })).success).toBe(
      true,
    );
  });

  it('rejects an invalid time format', () => {
    expect(businessHoursDaySchema.safeParse(day({ opensAt: '9am' })).success).toBe(false);
  });

  it('rejects hour 24', () => {
    expect(businessHoursDaySchema.safeParse(day({ opensAt: '24:00' })).success).toBe(false);
  });

  it('rejects minute 60', () => {
    expect(businessHoursDaySchema.safeParse(day({ opensAt: '10:60' })).success).toBe(false);
  });

  it('rejects an unknown day name', () => {
    expect(businessHoursDaySchema.safeParse(day({ dayOfWeek: 'FUNDAY' })).success).toBe(false);
  });
});

describe('businessHoursSchema', () => {
  const week = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ] as const;

  it('accepts exactly 7 days', () => {
    const days = week.map((dayOfWeek) => day({ dayOfWeek }));
    expect(businessHoursSchema.safeParse(days).success).toBe(true);
  });

  it('rejects fewer than 7 days', () => {
    const days = week.slice(0, 6).map((dayOfWeek) => day({ dayOfWeek }));
    expect(businessHoursSchema.safeParse(days).success).toBe(false);
  });

  it('rejects more than 7 days', () => {
    const days = [...week, 'MONDAY'].map((dayOfWeek) => day({ dayOfWeek }));
    expect(businessHoursSchema.safeParse(days).success).toBe(false);
  });
});
