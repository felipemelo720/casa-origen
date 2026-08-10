import { publicEnv } from '@/config/public-env';

/**
 * Money helpers.
 *
 * Every amount in the system is an integer expressed in the currency's minor
 * unit. `CURRENCY_DECIMALS` is 0 for CLP, so an amount of `12990` renders as
 * `$12.990`. Switching currency only requires changing this table.
 */
const CURRENCY_DECIMALS: Record<string, number> = {
  CLP: 0,
  ARS: 0,
  PEN: 2,
  USD: 2,
  EUR: 2,
  MXN: 2,
  COP: 0,
};

export const currencyCode = publicEnv.NEXT_PUBLIC_CURRENCY;
export const currencyDecimals = CURRENCY_DECIMALS[currencyCode] ?? 2;

const formatter = new Intl.NumberFormat(publicEnv.NEXT_PUBLIC_LOCALE, {
  style: 'currency',
  currency: currencyCode,
  minimumFractionDigits: currencyDecimals,
  maximumFractionDigits: currencyDecimals,
});

/** Formats an integer minor-unit amount as localised currency. */
export function formatMoney(amount: number): string {
  return formatter.format(amount / 10 ** currencyDecimals);
}

/**
 * Formats a quoted band ("$2.000 – $3.000"). Collapses to a single figure when
 * both ends match, so a flat fee never reads as an estimate.
 */
export function formatMoneyRange(min: number, max: number): string {
  if (max <= min) return formatMoney(min);
  return `${formatMoney(min)} – ${formatMoney(max)}`;
}

/** Parses user input ("12.990", "$12990") back into minor units. */
export function parseMoney(input: string): number {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length === 0) return 0;
  return Number.parseInt(digits, 10);
}

/**
 * Applies a percentage expressed in whole points, rounding half-up.
 * Kept integer-only so totals never drift.
 */
export function percentageOf(amount: number, percentPoints: number): number {
  return Math.round((amount * percentPoints) / 100);
}

/** Sums a list of amounts, guarding against non-finite values. */
export function sumMoney(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + (Number.isFinite(amount) ? amount : 0), 0);
}

/** Never lets a computed total go negative. */
export function nonNegative(amount: number): number {
  return amount < 0 ? 0 : Math.round(amount);
}
