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

  it('rejects a closing time at or before the opening time', () => {
    expect(businessHoursDaySchema.safeParse(day({ closesAt: '09:00' })).success).toBe(false);
    expect(businessHoursDaySchema.safeParse(day({ closesAt: '08:00' })).success).toBe(false);
  });

  it('rejects half a shift', () => {
    expect(businessHoursDaySchema.safeParse(day({ closesAt: null })).success).toBe(false);
  });
});

describe('businessHoursDaySchema — segundo turno', () => {
  const split = (overrides: Record<string, unknown> = {}) =>
    day({
      opensAt: '12:30',
      closesAt: '15:00',
      opensAt2: '18:00',
      closesAt2: '22:00',
      ...overrides,
    });

  it('accepts two shifts in the same day', () => {
    expect(businessHoursDaySchema.safeParse(split()).success).toBe(true);
  });

  it('defaults the second shift to null when it is absent', () => {
    const parsed = businessHoursDaySchema.safeParse(day());
    expect(parsed.success && parsed.data.opensAt2).toBe(null);
    expect(parsed.success && parsed.data.closesAt2).toBe(null);
  });

  it('rejects half a second shift', () => {
    expect(businessHoursDaySchema.safeParse(split({ closesAt2: null })).success).toBe(false);
    expect(businessHoursDaySchema.safeParse(split({ opensAt2: null })).success).toBe(false);
  });

  it('rejects a second shift without a first one', () => {
    expect(businessHoursDaySchema.safeParse(split({ opensAt: null, closesAt: null })).success).toBe(
      false,
    );
  });

  it('rejects a second shift that closes before it opens', () => {
    expect(businessHoursDaySchema.safeParse(split({ closesAt2: '18:00' })).success).toBe(false);
  });

  it('rejects shifts that overlap', () => {
    expect(businessHoursDaySchema.safeParse(split({ opensAt2: '14:00' })).success).toBe(false);
  });

  it('accepts a second shift starting exactly when the first closes', () => {
    expect(businessHoursDaySchema.safeParse(split({ opensAt2: '15:00' })).success).toBe(true);
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
