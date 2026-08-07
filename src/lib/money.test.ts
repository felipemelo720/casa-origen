import { describe, expect, it } from 'vitest';
import { formatMoney, nonNegative, parseMoney, percentageOf, sumMoney } from './money';

describe('formatMoney', () => {
  it('formats CLP without decimals', () => {
    expect(formatMoney(12990)).toBe('$12.990');
  });

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0');
  });
});

describe('parseMoney', () => {
  it('strips thousands separators and currency symbol', () => {
    expect(parseMoney('$12.990')).toBe(12990);
  });

  it('returns 0 for empty input', () => {
    expect(parseMoney('')).toBe(0);
  });

  it('returns 0 when there are no digits', () => {
    expect(parseMoney('abc')).toBe(0);
  });
});

describe('percentageOf', () => {
  it('rounds half-up', () => {
    expect(percentageOf(1000, 10)).toBe(100);
    expect(percentageOf(999, 50)).toBe(500); // 499.5 -> 500
  });

  it('returns 0 for 0%', () => {
    expect(percentageOf(1000, 0)).toBe(0);
  });
});

describe('sumMoney', () => {
  it('sums a list of integer amounts', () => {
    expect(sumMoney([1000, 2000, 500])).toBe(3500);
  });

  it('ignores non-finite values instead of poisoning the total', () => {
    expect(sumMoney([1000, Number.NaN, 500])).toBe(1500);
  });

  it('returns 0 for an empty list', () => {
    expect(sumMoney([])).toBe(0);
  });
});

describe('nonNegative', () => {
  it('clamps negative amounts to 0', () => {
    expect(nonNegative(-500)).toBe(0);
  });

  it('rounds fractional amounts', () => {
    expect(nonNegative(1999.4)).toBe(1999);
    expect(nonNegative(1999.6)).toBe(2000);
  });

  it('leaves positive integers untouched', () => {
    expect(nonNegative(5000)).toBe(5000);
  });
});
