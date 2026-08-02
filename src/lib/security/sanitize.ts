/**
 * Input sanitisation.
 *
 * React escapes everything it renders, so these helpers exist to normalise
 * stored data — not as the primary XSS defence. `dangerouslySetInnerHTML` is
 * never used anywhere in this codebase.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Collapses whitespace, strips control characters and enforces a max length. */
export function sanitizeText(value: string, maxLength = 2_000): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Same as `sanitizeText` but preserves intentional line breaks. */
export function sanitizeMultiline(value: string, maxLength = 5_000): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/** Normalises a phone number to digits with an optional leading `+`. */
export function sanitizePhone(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+')
    ? `+${cleaned.slice(1).replace(/\+/g, '')}`
    : cleaned.replace(/\+/g, '');
}

export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 254);
}

/** Blocks `javascript:` and other non-http(s) schemes in stored links. */
export function sanitizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) return trimmed.slice(0, 2_048);

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString().slice(0, 2_048);
  } catch {
    return null;
  }
}
