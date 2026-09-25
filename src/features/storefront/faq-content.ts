import { formatMoney, formatMoneyRange } from '@/lib/money';
import { formatShifts } from '@/lib/schedule-format';
import type { ScheduleDay } from '@/server/services/schedule.service';

export type FaqItem = { question: string; answer: string };

/** Lo justo para responder: nada de filas de Prisma. */
export type FaqInput = {
  deliveryEnabled: boolean;
  freeDeliveryFrom: number;
  zones: { name: string; deliveryFeeMin: number; deliveryFeeMax: number }[];
  schedule: Pick<ScheduleDay, 'label' | 'isClosed' | 'slots'>[];
  paymentMethods: string[];
};

/**
 * Las preguntas de la landing, armadas con los mismos datos que usa el
 * checkout. Nada escrito a mano: si el admin apaga una zona o un medio de
 * pago, la respuesta cambia sola y la FAQ no promete lo que `placeOrder`
 * rechaza. Una pregunta sin respuesta verdadera no se muestra.
 */
export function buildFaq(input: FaqInput): FaqItem[] {
  const items: FaqItem[] = [];

  if (!input.deliveryEnabled || input.zones.length === 0) {
    items.push({
      question: '¿Hacen despacho?',
      answer: 'Por ahora el despacho está pausado: puedes pedir y retirar.',
    });
  } else {
    items.push({
      question: '¿Llegan a mi sector?',
      answer: `Despachamos en ${joinList(input.zones.map((zone) => zone.name))}.`,
    });

    const min = Math.min(...input.zones.map((zone) => zone.deliveryFeeMin));
    const max = Math.max(...input.zones.map((zone) => zone.deliveryFeeMax));
    const free =
      input.freeDeliveryFrom > 0
        ? ` Gratis en pedidos desde ${formatMoney(input.freeDeliveryFrom)}.`
        : '';
    items.push({
      question: '¿Cuánto cuesta el despacho?',
      answer: `${formatMoneyRange(min, max)}, según la zona.${free}`,
    });
  }

  const openDays = input.schedule.filter((day) => !day.isClosed && day.slots.length > 0);
  if (openDays.length > 0) {
    items.push({
      question: '¿Cuál es el horario?',
      answer: groupDays(input.schedule)
        .map((run) => `${run.label}: ${run.hours}`)
        .join('. ')
        .concat('.'),
    });
  }

  if (input.paymentMethods.length > 0) {
    items.push({
      question: '¿Cómo puedo pagar?',
      answer: `${capitalize(
        joinList(
          input.paymentMethods.map((m) => m.toLowerCase()),
          'o',
        ),
      )}.`,
    });
  }

  // Regla dura del proyecto: la cuenta nunca es requisito para pedir.
  items.push({
    question: '¿Necesito crear una cuenta?',
    // Solo lo que existe hoy: historial (con los pedidos de invitado del mismo
    // teléfono) y premios en preparación, en futuro, como dice `/cuenta`.
    answer:
      'No, puedes pedir sin cuenta. Con una, ves el historial de tus pedidos (también los que hiciste antes con el mismo teléfono) y quedas inscrito para los premios y descuentos que vienen.',
  });

  return items;
}

/** Días seguidos con el mismo horario, en un solo tramo: «Lunes a sábado». */
function groupDays(schedule: FaqInput['schedule']): { label: string; hours: string }[] {
  const runs: { first: string; last: string; count: number; hours: string }[] = [];

  for (const day of schedule) {
    const hours = day.isClosed ? 'cerrado' : formatShifts(day.slots);
    const current = runs.at(-1);
    if (current && current.hours === hours) {
      current.last = day.label;
      current.count += 1;
    } else {
      runs.push({ first: day.label, last: day.label, count: 1, hours });
    }
  }

  return runs.map((run) => ({
    label:
      run.count === 1
        ? run.first
        : `${run.first} ${run.count === 2 ? 'y' : 'a'} ${run.last.toLowerCase()}`,
    hours: run.hours,
  }));
}

function joinList(parts: string[], conjunction = 'y'): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ${conjunction} ${parts.at(-1) ?? ''}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
