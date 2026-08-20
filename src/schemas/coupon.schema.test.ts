import { describe, expect, it } from 'vitest';

import { createCouponSchema } from './coupon.schema';

function baseCoupon(overrides: Record<string, unknown> = {}) {
  return {
    code: 'MARTES20',
    discountType: 'PERCENTAGE',
    value: 20,
    minSubtotal: 0,
    maxDiscount: null,
    usageLimit: null,
    perCustomerLimit: 1,
    freeDelivery: false,
    isActive: true,
    isPublic: false,
    endsAt: null,
    ...overrides,
  };
}

const IN_A_WEEK = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const LAST_WEEK = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

describe('createCouponSchema — código', () => {
  it('normaliza a mayúsculas y recorta espacios', () => {
    const parsed = createCouponSchema.safeParse(baseCoupon({ code: '  martes20 ' }));
    expect(parsed.success && parsed.data.code).toBe('MARTES20');
  });

  it('rechaza un código con espacios adentro', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ code: 'MARTES 20' })).success).toBe(false);
  });

  it('rechaza un código de menos de 3 caracteres', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ code: 'AB' })).success).toBe(false);
  });
});

describe('createCouponSchema — porcentaje', () => {
  it('acepta 1 a 100', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ value: 100 })).success).toBe(true);
  });

  it('rechaza 0 y más de 100', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ value: 0 })).success).toBe(false);
    expect(createCouponSchema.safeParse(baseCoupon({ value: 101 })).success).toBe(false);
  });

  it('acepta un tope de descuento', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ maxDiscount: 6000 })).success).toBe(true);
  });
});

describe('createCouponSchema — monto fijo', () => {
  function fixed(overrides: Record<string, unknown> = {}) {
    return baseCoupon({ discountType: 'FIXED', value: 3000, ...overrides });
  }

  it('acepta un monto', () => {
    expect(createCouponSchema.safeParse(fixed()).success).toBe(true);
  });

  // El cupón que rompía el motor: válido, aceptado y sin ningún efecto.
  it('rechaza $0 sin envío gratis', () => {
    expect(createCouponSchema.safeParse(fixed({ value: 0 })).success).toBe(false);
  });

  it('acepta $0 cuando el efecto es el envío gratis', () => {
    expect(createCouponSchema.safeParse(fixed({ value: 0, freeDelivery: true })).success).toBe(
      true,
    );
  });

  it('rechaza un tope: sólo tiene sentido sobre un porcentaje', () => {
    expect(createCouponSchema.safeParse(fixed({ maxDiscount: 6000 })).success).toBe(false);
  });
});

describe('createCouponSchema — límites y vigencia', () => {
  it('acepta usos totales vacíos como ilimitado', () => {
    const parsed = createCouponSchema.safeParse(baseCoupon({ usageLimit: null }));
    expect(parsed.success && parsed.data.usageLimit).toBeNull();
  });

  it('rechaza un límite de 0 usos: eso es un cupón apagado, no uno limitado', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ usageLimit: 0 })).success).toBe(false);
    expect(createCouponSchema.safeParse(baseCoupon({ perCustomerLimit: 0 })).success).toBe(false);
  });

  it('acepta una fecha de término futura', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ endsAt: IN_A_WEEK })).success).toBe(true);
  });

  it('rechaza un cupón que nace vencido', () => {
    expect(createCouponSchema.safeParse(baseCoupon({ endsAt: LAST_WEEK })).success).toBe(false);
  });
});
