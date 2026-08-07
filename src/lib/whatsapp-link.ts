/**
 * A wa.me link for a stored number. `wa.me` only accepts digits, so anything
 * the admin typed for humans (`+56 9 1234 5678`) has to be stripped first.
 *
 * Lives apart from `whatsapp.ts` on purpose: that module pulls in the cart
 * store, and server components (header, footer) only need the URL.
 */
export function buildWhatsAppUrl(whatsappNumber: string, message?: string): string {
  const digits = whatsappNumber.replace(/[^\d]/g, '');
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
}
