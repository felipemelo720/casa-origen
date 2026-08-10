import { describe, expect, it } from 'vitest';

import {
  buildWhatsAppOrderMessage,
  buildWhatsAppOrderUrl,
  type WhatsAppOrderInput,
} from '@/lib/whatsapp-order-message';

function order(overrides: Partial<WhatsAppOrderInput> = {}): WhatsAppOrderInput {
  return {
    code: 'CO-260807-0001',
    firstName: 'Ana',
    lastName: 'Pérez',
    phone: '+56912345678',
    orderType: 'PICKUP',
    paymentMethodName: 'Efectivo',
    subtotal: 12000,
    discount: 0,
    deliveryFee: 0,
    deliveryFeeMax: 0,
    total: 12000,
    estimatedMinutes: 30,
    items: [
      {
        name: 'Pizza Margarita',
        quantity: 1,
        lineTotal: 12000,
        variants: [{ optionName: 'Familiar' }],
        extras: [],
        removedIngredientNames: [],
      },
    ],
    ...overrides,
  };
}

function manyItems(count: number): WhatsAppOrderInput['items'] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Pizza de prueba con un nombre bien largo número ${index}`,
    quantity: 2,
    lineTotal: 15900,
    variants: [{ optionName: 'Familiar' }, { optionName: 'Masa delgada' }],
    extras: [{ name: 'Extra queso', quantity: 1 }],
    removedIngredientNames: ['aceitunas'],
  }));
}

describe('buildWhatsAppOrderMessage', () => {
  it('lists items with their variants, extras and removals', () => {
    const message = buildWhatsAppOrderMessage(
      order({
        items: [
          {
            name: 'Pizza Margarita',
            quantity: 2,
            lineTotal: 23800,
            variants: [{ optionName: 'Familiar' }],
            extras: [{ name: 'Extra queso', quantity: 2 }],
            removedIngredientNames: ['albahaca'],
          },
        ],
      }),
    );

    expect(message).toContain('2x Pizza Margarita (Familiar, +2 Extra queso, sin albahaca)');
  });

  it('spells out the delivery address and the change owed', () => {
    const message = buildWhatsAppOrderMessage(
      order({
        orderType: 'DELIVERY',
        street: 'Av. Siempre Viva 742',
        communeName: 'Paine',
        deliveryFee: 2500,
        total: 14500,
        cashGiven: 20000,
        changeDue: 5500,
      }),
    );

    expect(message).toContain('Entrega: Delivery — Av. Siempre Viva 742, Paine');
    expect(message).toContain('Despacho: $2.500');
    expect(message).toContain('paga con $20.000, vuelto $5.500');
  });

  it('quotes the band and flags the total when the fee is an estimate', () => {
    const message = buildWhatsAppOrderMessage(
      order({
        orderType: 'DELIVERY',
        street: 'Av. Siempre Viva 742',
        communeName: 'Champa',
        deliveryFee: 3500,
        deliveryFeeMax: 5000,
        total: 15500,
      }),
    );

    expect(message).toContain('Despacho: $3.500 – $5.000 (por confirmar)');
    expect(message).toContain('*Total: $15.500*');
    expect(message).toContain('Total con el despacho más bajo del sector.');
  });

  it('states one figure when the zone charges a flat fee', () => {
    const message = buildWhatsAppOrderMessage(
      order({ orderType: 'DELIVERY', deliveryFee: 6000, deliveryFeeMax: 6000, total: 18000 }),
    );

    expect(message).toContain('Despacho: $6.000');
    expect(message).not.toContain('por confirmar');
  });

  it('omits the delivery line for a pickup order', () => {
    expect(buildWhatsAppOrderMessage(order())).toContain('Entrega: Retiro en tienda');
    expect(buildWhatsAppOrderMessage(order())).not.toContain('Despacho');
  });
});

describe('buildWhatsAppOrderUrl', () => {
  it('strips everything that is not a digit from the number', () => {
    const url = buildWhatsAppOrderUrl('+56 9 1234 5678', order());
    expect(url?.startsWith('https://wa.me/56912345678?text=')).toBe(true);
  });

  it('returns null when no number is configured', () => {
    expect(buildWhatsAppOrderUrl(null, order())).toBeNull();
    expect(buildWhatsAppOrderUrl('sin número', order())).toBeNull();
  });

  it('drops line items until the url fits, keeping the total and the customer', () => {
    const url = buildWhatsAppOrderUrl(
      '+56912345678',
      order({ items: manyItems(40), total: 636000 }),
    );
    if (url === null) throw new Error('expected a url');

    expect(url.length).toBeLessThanOrEqual(1800);

    const encoded = url.split('?text=')[1];
    if (encoded === undefined) throw new Error('expected a text query param');
    const text = decodeURIComponent(encoded);
    expect(text).toContain('productos más');
    expect(text).toContain('*Total: $636.000*');
    expect(text).toContain('Teléfono: +56912345678');
  });
});
