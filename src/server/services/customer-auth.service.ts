import 'server-only';

import {
  customerRepository,
  type CustomerAccount,
} from '@/server/repositories/customer.repository';
import { createCustomerSession, getCustomerSessionId } from '@/lib/auth/customer-session';
import { hashPassword, verifyPassword } from '@/lib/security/password';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/security/sanitize';
import { BusinessRuleError, ConflictError } from '@/lib/errors';
import type { LoginInput, RegisterInput } from '@/schemas/customer-auth.schema';

/**
 * Customer accounts: register, log in, and read the current session.
 *
 * Accounts are additive. Guest checkout still works, so nothing here may ever
 * become a precondition for placing an order.
 */

export async function registerCustomer(input: RegisterInput): Promise<CustomerAccount> {
  const email = sanitizeEmail(input.email);
  const phone = sanitizePhone(input.phone);

  const existing = await customerRepository.findAuthByEmail(email);
  if (existing) {
    throw new ConflictError('Ese correo ya tiene una cuenta. Inicia sesión.');
  }

  // The phone may already exist as a guest row from a previous order. Taking it
  // over is the point — that history belongs to this person — but only when it
  // has no credentials yet, otherwise a stranger could claim someone's account
  // by typing their phone number.
  const byPhone = await customerRepository.findByPhone(phone);
  if (byPhone?.passwordHash) {
    throw new ConflictError('Ese teléfono ya tiene una cuenta. Inicia sesión.');
  }

  const account = await customerRepository.upsertAccountByPhone(phone, {
    firstName: sanitizeText(input.firstName, 60),
    lastName: sanitizeText(input.lastName, 60),
    email,
    passwordHash: await hashPassword(input.password),
  });

  await createCustomerSession(account.id);
  return account;
}

export async function loginCustomer(input: LoginInput): Promise<CustomerAccount> {
  const email = sanitizeEmail(input.email);
  const found = await customerRepository.findAuthByEmail(email);

  // One message for "no such email", "guest row without password" and "wrong
  // password": splitting them turns the form into an account-existence oracle.
  const invalid = new BusinessRuleError('Correo o contraseña incorrectos.');

  if (!found?.passwordHash) {
    // Still spend the hashing time, so a missing account is not a faster reply.
    await verifyPassword(input.password, 'scrypt$16384$8$1$00$00');
    throw invalid;
  }

  if (!(await verifyPassword(input.password, found.passwordHash))) throw invalid;
  if (found.isBlocked) throw new BusinessRuleError('Tu cuenta está suspendida. Contáctanos.');

  const { passwordHash: _passwordHash, isBlocked: _isBlocked, ...account } = found;
  await createCustomerSession(account.id);
  return account;
}

/** The signed-in customer, or null. Safe to call from any server component. */
export async function getCurrentCustomer(): Promise<CustomerAccount | null> {
  const id = await getCustomerSessionId();
  if (id === null) return null;
  // The cookie survives a deleted row, so the id is re-checked against the DB.
  return customerRepository.findAccountById(id);
}
