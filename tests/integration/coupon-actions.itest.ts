import { beforeEach, describe, expect, it } from 'vitest';

import { env } from '@/config/env';
import { prisma } from '@/lib/db/prisma';
import { deriveAdminSessionToken } from '@/lib/security/session-token';
import {
  createCouponAction,
  updateCouponAction,
  setCouponActiveAction,
} from '@/server/actions/coupon.actions';

import { resetDb } from '../setup/db';
import { setCookie } from '../setup/request-context';

async function signInAsAdmin(): Promise<void> {
  setCookie('admin_session', await deriveAdminSessionToken(env.ADMIN_PASSWORD));
}

function buildCouponForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set('code', 'DESCUENTO10');
  formData.set('discountType', 'FIXED');
  formData.set('value', '3.000');
  formData.set('minSubtotal', '0');
  formData.set('perCustomerLimit', '1');
  formData.set('isActive', 'on');
  // freeDelivery / isPublic left unchecked by default — an unchecked box just
  // never appears in the FormData.
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

// `coupons` is catalogue-ish and not in resetDb()'s TRANSACTIONAL_TABLES — the
// seed's BIENVENIDA10/ENVIOGRATIS persist across tests, and so would anything
// this file creates. Every code used here is deleted before each test runs,
// so ordering never matters and a failed run doesn't poison the next one.
const TEST_CODES = ['DESCUENTO10', 'UNO', 'DOS'];

describe('coupon actions (integración)', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.coupon.deleteMany({ where: { code: { in: TEST_CODES } } });
  });

  it('rejects creating a coupon without the admin cookie', async () => {
    const result = await createCouponAction(null, buildCouponForm());

    expect(result.ok).toBe(false);
    expect(await prisma.coupon.findUnique({ where: { code: 'DESCUENTO10' } })).toBeNull();
  });

  it('creates a coupon and the parsed amount lands in Postgres as an integer', async () => {
    await signInAsAdmin();

    const result = await createCouponAction(null, buildCouponForm());
    expect(result.ok).toBe(true);

    const row = await prisma.coupon.findUniqueOrThrow({ where: { code: 'DESCUENTO10' } });
    expect(row.value).toBe(3000);
    expect(row.discountType).toBe('FIXED');
    expect(row.isActive).toBe(true);
    expect(row.freeDelivery).toBe(false);
  });

  it('rejects a $0 FIXED coupon with no free delivery — the case that broke pricing once', async () => {
    await signInAsAdmin();

    const result = await createCouponAction(null, buildCouponForm({ value: '0' }));

    expect(result.ok).toBe(false);
    expect(await prisma.coupon.findUnique({ where: { code: 'DESCUENTO10' } })).toBeNull();
  });

  it('rejects a duplicate code', async () => {
    await signInAsAdmin();
    await createCouponAction(null, buildCouponForm());

    const result = await createCouponAction(null, buildCouponForm());
    expect(result.ok).toBe(false);
    expect(await prisma.coupon.findMany({ where: { code: 'DESCUENTO10' } })).toHaveLength(1);
  });

  it('updates an existing coupon in place', async () => {
    await signInAsAdmin();
    await createCouponAction(null, buildCouponForm());
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: 'DESCUENTO10' } });

    const result = await updateCouponAction(
      coupon.id,
      null,
      buildCouponForm({ value: '5.000', description: 'Editado' }),
    );

    expect(result.ok).toBe(true);
    const updated = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(updated.value).toBe(5000);
    expect(updated.description).toBe('Editado');
  });

  it("lets an edit keep its own code, but not steal another coupon's", async () => {
    await signInAsAdmin();
    await createCouponAction(null, buildCouponForm({ code: 'UNO' }));
    await createCouponAction(null, buildCouponForm({ code: 'DOS' }));
    const uno = await prisma.coupon.findUniqueOrThrow({ where: { code: 'UNO' } });

    const sameCode = await updateCouponAction(uno.id, null, buildCouponForm({ code: 'UNO' }));
    expect(sameCode.ok).toBe(true);

    const stolenCode = await updateCouponAction(uno.id, null, buildCouponForm({ code: 'DOS' }));
    expect(stolenCode.ok).toBe(false);
  });

  it('toggles active state without touching the rest of the row', async () => {
    await signInAsAdmin();
    await createCouponAction(null, buildCouponForm());
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: 'DESCUENTO10' } });

    const result = await setCouponActiveAction(coupon.id, false, null, new FormData());
    expect(result.ok).toBe(true);

    const updated = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(updated.isActive).toBe(false);
    expect(updated.value).toBe(3000); // untouched
  });
});
