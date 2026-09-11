import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db/prisma';
import {
  registerCustomerAction,
  loginCustomerAction,
  logoutCustomerAction,
  getCurrentCustomerAction,
} from '@/server/actions/customer-auth.actions';

import { resetDb } from '../setup/db';
import { cookieStore } from '../setup/request-context';

const validRegister = {
  firstName: 'Ana',
  lastName: 'Soto',
  email: 'ana@example.com',
  phone: '+56911112222',
  password: 'correct horse',
};

describe('customer-auth actions (integración)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('registers, sets the session cookie, and the row lands in Postgres', async () => {
    const result = await registerCustomerAction(validRegister);

    expect(result.ok).toBe(true);
    expect(cookieStore.has('customer_session')).toBe(true);

    const row = await prisma.customer.findUniqueOrThrow({ where: { email: 'ana@example.com' } });
    expect(row.firstName).toBe('Ana');
    expect(row.passwordHash).not.toBeNull();
  });

  it('rejects a second registration on the same email', async () => {
    await registerCustomerAction(validRegister);
    const result = await registerCustomerAction({ ...validRegister, phone: '+56922223333' });

    expect(result.ok).toBe(false);
  });

  it('adopts an existing guest row from checkout instead of forking a second customer', async () => {
    await prisma.customer.create({
      data: {
        phone: '+56911112222',
        firstName: 'Invitado',
        lastName: 'Anon',
        orderCount: 2,
        totalSpent: 15000,
      },
    });

    const result = await registerCustomerAction(validRegister);
    expect(result.ok).toBe(true);

    const rows = await prisma.customer.findMany({ where: { phone: '+56911112222' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.orderCount).toBe(2); // guest history survives the adoption
    expect(rows[0]?.firstName).toBe('Ana'); // but the registered name wins
  });

  it('logs in with the right password and reads back the session via getCurrentCustomerAction', async () => {
    await registerCustomerAction(validRegister);
    cookieStore.delete('customer_session'); // registering already logs in; start clean

    const login = await loginCustomerAction({
      email: 'ana@example.com',
      password: 'correct horse',
    });
    expect(login.ok).toBe(true);

    const current = await getCurrentCustomerAction(undefined);
    expect(current.ok).toBe(true);
    if (current.ok) expect(current.data?.email).toBe('ana@example.com');
  });

  it('rejects a wrong password with the same shape as a nonexistent email (no oracle)', async () => {
    await registerCustomerAction(validRegister);

    const wrongPassword = await loginCustomerAction({
      email: 'ana@example.com',
      password: 'not-the-password',
    });
    const noSuchEmail = await loginCustomerAction({
      email: 'nadie@example.com',
      password: 'whatever1',
    });

    expect(wrongPassword.ok).toBe(false);
    expect(noSuchEmail.ok).toBe(false);
    if (!wrongPassword.ok && !noSuchEmail.ok) {
      expect(wrongPassword.message).toBe(noSuchEmail.message);
    }
  });

  it('logout clears the session so getCurrentCustomerAction returns null', async () => {
    await registerCustomerAction(validRegister);

    await logoutCustomerAction(undefined);
    const current = await getCurrentCustomerAction(undefined);

    expect(current.ok).toBe(true);
    if (current.ok) expect(current.data).toBeNull();
  });
});
