import { describe, expect, it } from 'vitest';
import { updateCommunesSchema } from './commune.schema';

function zone(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'commune-1',
    deliveryFeeMin: 1500,
    deliveryFeeMax: 4000,
    extraMinutes: 10,
    isActive: true,
    ...overrides,
  };
}

describe('updateCommunesSchema', () => {
  it('accepts a valid zone', () => {
    expect(updateCommunesSchema.safeParse([zone()]).success).toBe(true);
  });

  it('rejects an inverted band (max below min)', () => {
    const result = updateCommunesSchema.safeParse([
      zone({ deliveryFeeMin: 4000, deliveryFeeMax: 1500 }),
    ]);
    expect(result.success).toBe(false);
  });

  it('accepts a flat band (max equal to min)', () => {
    const result = updateCommunesSchema.safeParse([
      zone({ deliveryFeeMin: 2000, deliveryFeeMax: 2000 }),
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects a negative fee', () => {
    expect(updateCommunesSchema.safeParse([zone({ deliveryFeeMin: -1 })]).success).toBe(false);
  });

  it('rejects extraMinutes over the 240 cap', () => {
    expect(updateCommunesSchema.safeParse([zone({ extraMinutes: 241 })]).success).toBe(false);
  });

  it('rejects an empty list — at least one zone must be sent', () => {
    expect(updateCommunesSchema.safeParse([]).success).toBe(false);
  });

  it('rejects a zone missing an id', () => {
    expect(updateCommunesSchema.safeParse([zone({ id: '' })]).success).toBe(false);
  });
});
