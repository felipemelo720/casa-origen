import { describe, expect, it } from 'vitest';
import { cn, slugify } from './utils';

describe('cn', () => {
  it('merges class lists', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });

  it('lets a later Tailwind utility win over an earlier conflicting one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    expect(cn('px-2', false && 'hidden', undefined, 'py-1')).toBe('px-2 py-1');
  });
});

describe('slugify', () => {
  it('lowercases and dashes spaces', () => {
    expect(slugify('Pizza Margarita')).toBe('pizza-margarita');
  });

  it('strips accents', () => {
    expect(slugify('Jalapeño Picante')).toBe('jalapeno-picante');
  });

  it('collapses repeated separators and trims leading/trailing dashes', () => {
    expect(slugify('  --Extra   Queso!!--  ')).toBe('extra-queso');
  });

  it('caps length at 96 chars', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBe(96);
  });
});
