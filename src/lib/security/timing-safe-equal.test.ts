import { describe, expect, it } from 'vitest';
import { timingSafeEqual } from './timing-safe-equal';

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('secret123', 'secret123')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(timingSafeEqual('secret123', 'secret124')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeEqual('short', 'a-much-longer-string')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('returns false when one side is empty', () => {
    expect(timingSafeEqual('', 'x')).toBe(false);
  });

  it('handles multi-byte (unicode) input without throwing', () => {
    expect(timingSafeEqual('contraseña🍕', 'contraseña🍕')).toBe(true);
    expect(timingSafeEqual('contraseña🍕', 'contraseña🍔')).toBe(false);
  });
});
