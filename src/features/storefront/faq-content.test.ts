import { describe, expect, it } from 'vitest';

import { formatMoney, formatMoneyRange } from '@/lib/money';

import { buildFaq, type FaqInput } from './faq-content';

function input(overrides: Partial<FaqInput> = {}): FaqInput {
  return {
    deliveryEnabled: true,
    freeDeliveryFrom: 0,
    zones: [
      { name: 'Paine Centro', deliveryFeeMin: 2000, deliveryFeeMax: 3000 },
      { name: 'Champa', deliveryFeeMin: 3500, deliveryFeeMax: 5000 },
      { name: 'Viluco', deliveryFeeMin: 3000, deliveryFeeMax: 4500 },
    ],
    schedule: [
      { label: 'Lunes', isClosed: true, slots: [] },
      {
        label: 'Martes',
        isClosed: false,
        slots: [
          { opensAt: '12:30', closesAt: '15:00' },
          { opensAt: '18:00', closesAt: '22:00' },
        ],
      },
    ],
    paymentMethods: ['Transferencia', 'Efectivo'],
    ...overrides,
  };
}

function answerTo(items: ReturnType<typeof buildFaq>, question: string): string | undefined {
  return items.find((item) => item.question === question)?.answer;
}

describe('buildFaq', () => {
  it('lists every active zone, in order', () => {
    expect(answerTo(buildFaq(input()), '¿Llegan a mi sector?')).toBe(
      'Despachamos en Paine Centro, Champa y Viluco.',
    );
  });

  it('quotes the fee from the cheapest to the most expensive zone', () => {
    expect(answerTo(buildFaq(input()), '¿Cuánto cuesta el despacho?')).toBe(
      `${formatMoneyRange(2000, 5000)}, según la zona.`,
    );
  });

  it('mentions free delivery only when the rule is on', () => {
    const answer = answerTo(
      buildFaq(input({ freeDeliveryFrom: 35000 })),
      '¿Cuánto cuesta el despacho?',
    );
    expect(answer).toContain(`Gratis en pedidos desde ${formatMoney(35000)}.`);
    expect(answerTo(buildFaq(input()), '¿Cuánto cuesta el despacho?')).not.toContain('Gratis');
  });

  it('does not promise delivery when the admin paused it', () => {
    const items = buildFaq(input({ deliveryEnabled: false }));
    expect(answerTo(items, '¿Llegan a mi sector?')).toBeUndefined();
    expect(answerTo(items, '¿Cuánto cuesta el despacho?')).toBeUndefined();
    expect(answerTo(items, '¿Hacen despacho?')).toMatch(/pausado/);
  });

  it('treats an empty zone list like paused delivery', () => {
    const items = buildFaq(input({ zones: [] }));
    expect(answerTo(items, '¿Cuánto cuesta el despacho?')).toBeUndefined();
    expect(answerTo(items, '¿Hacen despacho?')).toBeDefined();
  });

  it('spells out the week, split shifts included', () => {
    expect(answerTo(buildFaq(input()), '¿Cuál es el horario?')).toBe(
      'Lunes: cerrado. Martes: 12:30 – 15:00 y 18:00 – 22:00.',
    );
  });

  it('groups consecutive days that share the same hours', () => {
    const split = [
      { opensAt: '12:30', closesAt: '15:00' },
      { opensAt: '18:00', closesAt: '22:00' },
    ];
    const week = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((label) => ({
      label,
      isClosed: false,
      slots: split,
    }));
    const items = buildFaq(
      input({ schedule: [...week, { label: 'Domingo', isClosed: true, slots: [] }] }),
    );
    expect(answerTo(items, '¿Cuál es el horario?')).toBe(
      'Lunes a sábado: 12:30 – 15:00 y 18:00 – 22:00. Domingo: cerrado.',
    );
  });

  it('joins a two-day run with «y» and never merges days that are apart', () => {
    const slot = [{ opensAt: '18:00', closesAt: '22:00' }];
    const items = buildFaq(
      input({
        schedule: [
          { label: 'Viernes', isClosed: false, slots: slot },
          { label: 'Sábado', isClosed: false, slots: slot },
          { label: 'Domingo', isClosed: true, slots: [] },
          { label: 'Lunes', isClosed: false, slots: slot },
        ],
      }),
    );
    expect(answerTo(items, '¿Cuál es el horario?')).toBe(
      'Viernes y sábado: 18:00 – 22:00. Domingo: cerrado. Lunes: 18:00 – 22:00.',
    );
  });

  it('drops the schedule question when no day is open', () => {
    const items = buildFaq(input({ schedule: [{ label: 'Lunes', isClosed: true, slots: [] }] }));
    expect(answerTo(items, '¿Cuál es el horario?')).toBeUndefined();
  });

  it('names only the payment methods it is given', () => {
    expect(answerTo(buildFaq(input()), '¿Cómo puedo pagar?')).toBe('Transferencia o efectivo.');
    expect(answerTo(buildFaq(input({ paymentMethods: ['Efectivo'] })), '¿Cómo puedo pagar?')).toBe(
      'Efectivo.',
    );
    expect(answerTo(buildFaq(input({ paymentMethods: [] })), '¿Cómo puedo pagar?')).toBeUndefined();
  });

  it('always says an account is optional', () => {
    const answer = answerTo(buildFaq(input()), '¿Necesito crear una cuenta?');
    expect(answer).toMatch(/^No, puedes pedir sin cuenta\./);
    expect(answer).toContain('historial');
  });
});
