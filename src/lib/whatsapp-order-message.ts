import { formatMoney } from '@/lib/money';

/**
 * The confirmed order, as the pricing engine priced it. Deliberately not the
 * cart the browser holds: the message the operator reads has to say the same
 * numbers the order row says, so it is built from server totals only.
 */
export type WhatsAppOrderInput = {
  code: string;
  firstName: string;
  lastName: string;
  phone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  street?: string | undefined;
  reference?: string | undefined;
  communeName?: string | undefined;
  paymentMethodName: string;
  cashGiven?: number | undefined;
  changeDue?: number | undefined;
  notes?: string | undefined;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  estimatedMinutes: number;
  items: {
    name: string;
    quantity: number;
    lineTotal: number;
    variants: { optionName: string }[];
    extras: { name: string; quantity: number }[];
    removedIngredientNames: string[];
    notes?: string | undefined;
  }[];
};

/**
 * `wa.me` puts the message in the query string, and long URLs get silently
 * truncated (or rejected) by WhatsApp and by the browsers in between. Well
 * under the practical ~2000 char ceiling, measured on the *encoded* URL.
 */
const MAX_URL_LENGTH = 1800;

function formatItem(item: WhatsAppOrderInput['items'][number]): string {
  const details = [
    ...item.variants.map((variant) => variant.optionName),
    ...item.extras.map((extra) =>
      extra.quantity > 1 ? `+${extra.quantity} ${extra.name}` : `+ ${extra.name}`,
    ),
    ...item.removedIngredientNames.map((name) => `sin ${name}`),
  ];
  const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
  const note = item.notes ? `\n   ↳ ${item.notes}` : '';
  return `${item.quantity}x ${item.name}${suffix} — ${formatMoney(item.lineTotal)}${note}`;
}

/** The full message, with every line item spelled out. */
export function buildWhatsAppOrderMessage(order: WhatsAppOrderInput): string {
  return buildMessage(order, order.items.length);
}

function buildMessage(order: WhatsAppOrderInput, itemsShown: number): string {
  const shown = order.items.slice(0, itemsShown);
  const hidden = order.items.length - shown.length;

  const parts = [`*Pedido ${order.code}*`, '', ...shown.map(formatItem)];

  if (hidden > 0) {
    parts.push(
      `… y ${hidden} ${hidden === 1 ? 'producto más' : 'productos más'} (ver el detalle completo en el panel)`,
    );
  }

  parts.push('', `Subtotal: ${formatMoney(order.subtotal)}`);
  if (order.discount > 0) parts.push(`Descuento: -${formatMoney(order.discount)}`);
  if (order.orderType === 'DELIVERY') parts.push(`Despacho: ${formatMoney(order.deliveryFee)}`);
  parts.push(`*Total: ${formatMoney(order.total)}*`);

  parts.push(
    '',
    `Cliente: ${order.firstName} ${order.lastName}`,
    `Teléfono: ${order.phone}`,
    order.orderType === 'DELIVERY'
      ? `Entrega: Delivery — ${[order.street, order.communeName].filter(Boolean).join(', ')}`
      : 'Entrega: Retiro en tienda',
  );

  if (order.orderType === 'DELIVERY' && order.reference)
    parts.push(`Referencia: ${order.reference}`);

  const change =
    order.cashGiven !== undefined
      ? ` (paga con ${formatMoney(order.cashGiven)}, vuelto ${formatMoney(order.changeDue ?? 0)})`
      : '';
  parts.push(`Pago: ${order.paymentMethodName}${change}`);
  parts.push(`Estimado: ${order.estimatedMinutes} min`);

  if (order.notes) parts.push(`Notas: ${order.notes}`);

  return parts.join('\n');
}

/**
 * A `wa.me` deep link for the order, or `null` when no number is configured.
 *
 * Drops line items — never the totals or the customer's data — until the
 * encoded URL fits. A big order still reaches the operator with everything
 * needed to call them back; the full detail is in `/admin` either way.
 */
export function buildWhatsAppOrderUrl(
  whatsappNumber: string | null,
  order: WhatsAppOrderInput,
): string | null {
  if (!whatsappNumber) return null;

  const digits = whatsappNumber.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;

  for (let itemsShown = order.items.length; itemsShown >= 0; itemsShown -= 1) {
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(buildMessage(order, itemsShown))}`;
    if (url.length <= MAX_URL_LENGTH || itemsShown === 0) return url;
  }

  return null;
}
