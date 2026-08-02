import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes, letting later utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL-safe slug: strips accents, collapses separators, trims dashes. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** Clamps a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Removes `undefined` entries so Prisma treats them as "leave unchanged". */
export function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Splits a list into chunks of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError('chunk size must be positive');
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/** Minutes-from-midnight → `HH:mm`. */
export function minutesToTime(minutes: number): string {
  const safe = clamp(Math.trunc(minutes), 0, 24 * 60);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** `HH:mm` → minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [hours = '0', mins = '0'] = time.split(':');
  return clamp(Number(hours) * 60 + Number(mins), 0, 24 * 60);
}
