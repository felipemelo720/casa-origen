import { estimateLineTotal, type CartLine } from '@/features/cart/cart-store';
import { formatMoney } from '@/lib/money';

type OrderSummary = {
  code: string;
  firstName: string;
  lastName: string;
  phone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  street?: string;
  communeName?: string;
  paymentMethodName: string;
  cashGiven?: number;
  notes?: string;
  total: number;
};

function buildWhatsAppMessage(lines: CartLine[], order: OrderSummary): string {
  const itemLines = lines.map((line) => {
    const details = [
      ...line.variants.map((v) => v.optionName),
      ...line.extras.map((e) => `+ ${e.name}`),
    ];
    const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
    return `${line.quantity}x ${line.name}${suffix} — ${formatMoney(estimateLineTotal(line))}`;
  });

  const parts = [
    `Pedido ${order.code}`,
    '',
    ...itemLines,
    '',
    `Total: ${formatMoney(order.total)}`,
    '',
    `Cliente: ${order.firstName} ${order.lastName}`,
    `Teléfono: ${order.phone}`,
    order.orderType === 'DELIVERY'
      ? `Entrega: Delivery — ${order.street ?? ''}${order.communeName ? `, ${order.communeName}` : ''}`
      : 'Entrega: Retiro en tienda',
    `Pago: ${order.paymentMethodName}${order.cashGiven ? ` (con ${formatMoney(order.cashGiven)})` : ''}`,
  ];

  if (order.notes) parts.push(`Notas: ${order.notes}`);

  return parts.join('\n');
}

/** Opens a wa.me deep link with the order pre-filled, in addition to the DB record already saved. */
export function openWhatsAppOrder(
  whatsappNumber: string,
  lines: CartLine[],
  order: OrderSummary,
): void {
  const digits = whatsappNumber.replace(/[^\d]/g, '');
  const message = buildWhatsAppMessage(lines, order);
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
}
