import { beforeEach, describe, expect, it, vi } from 'vitest';

// customer-auth.service orchestrates the repository, session cookie, sanitizers
// and password hashing. Every collaborator is mocked so this file tests only
// the service's own rules (oracle-free login, guest-row adoption); hashing
// itself is covered in security/password.test.ts.
vi.mock('server-only', () => ({}));

vi.mock('@/server/repositories/customer.repository', () => ({
  customerRepository: {
    findAuthByEmail: vi.fn(),
    findByPhone: vi.fn(),
    upsertAccountByPhone: vi.fn(),
    findAccountById: vi.fn(),
  },
}));

vi.mock('@/lib/auth/customer-session', () => ({
  createCustomerSession: vi.fn(),
  getCustomerSessionId: vi.fn(),
}));

vi.mock('@/lib/security/password', () => ({
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
  verifyPassword: vi.fn(),
}));

import { registerCustomer, loginCustomer, getCurrentCustomer } from './customer-auth.service';
import { customerRepository } from '@/server/repositories/customer.repository';
import { createCustomerSession, getCustomerSessionId } from '@/lib/auth/customer-session';
import { hashPassword, verifyPassword } from '@/lib/security/password';
import { BusinessRuleError, ConflictError } from '@/lib/errors';

const validRegisterInput = {
  firstName: 'Ana',
  lastName: 'Soto',
  email: 'ana@example.com',
  phone: '+56911112222',
  password: 'correct horse',
};

const account = {
  id: 'cust_1',
  firstName: 'Ana',
  lastName: 'Soto',
  email: 'ana@example.com',
  phone: '+56911112222',
  orderCount: 0,
  totalSpent: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerCustomer', () => {
  it('rejects when the email already has an account', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue({
      ...account,
      passwordHash: 'scrypt$...',
      isBlocked: false,
    });

    await expect(registerCustomer(validRegisterInput)).rejects.toThrow(ConflictError);
    expect(customerRepository.upsertAccountByPhone).not.toHaveBeenCalled();
  });

  it('rejects claiming a phone that already has credentials (no stranger takeover)', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue(null);
    vi.mocked(customerRepository.findByPhone).mockResolvedValue({
      passwordHash: 'scrypt$already-has-one',
    } as never);

    await expect(registerCustomer(validRegisterInput)).rejects.toThrow(ConflictError);
    expect(customerRepository.upsertAccountByPhone).not.toHaveBeenCalled();
  });

  it('adopts an existing guest row (same phone, no password yet)', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue(null);
    vi.mocked(customerRepository.findByPhone).mockResolvedValue({ passwordHash: null } as never);
    vi.mocked(customerRepository.upsertAccountByPhone).mockResolvedValue(account);

    const result = await registerCustomer(validRegisterInput);

    expect(hashPassword).toHaveBeenCalledWith('correct horse');
    expect(customerRepository.upsertAccountByPhone).toHaveBeenCalledWith(
      '+56911112222',
      expect.objectContaining({ passwordHash: 'hashed:correct horse' }),
    );
    expect(createCustomerSession).toHaveBeenCalledWith('cust_1');
    expect(result).toEqual(account);
  });

  it('registers a brand-new phone with no prior guest row', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue(null);
    vi.mocked(customerRepository.findByPhone).mockResolvedValue(null);
    vi.mocked(customerRepository.upsertAccountByPhone).mockResolvedValue(account);

    await registerCustomer(validRegisterInput);

    expect(customerRepository.upsertAccountByPhone).toHaveBeenCalled();
    expect(createCustomerSession).toHaveBeenCalledWith('cust_1');
  });
});

describe('loginCustomer', () => {
  const input = { email: 'ana@example.com', password: 'whatever' };

  it('throws the same message for a nonexistent email as for a wrong password (no oracle)', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue(null);

    let missing: unknown;
    try {
      await loginCustomer(input);
    } catch (error) {
      missing = error;
    }

    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue({
      ...account,
      passwordHash: 'scrypt$real-hash',
      isBlocked: false,
    });
    vi.mocked(verifyPassword).mockResolvedValue(false);

    let wrongPassword: unknown;
    try {
      await loginCustomer(input);
    } catch (error) {
      wrongPassword = error;
    }

    expect(missing).toBeInstanceOf(BusinessRuleError);
    expect(wrongPassword).toBeInstanceOf(BusinessRuleError);
    expect((missing as Error).message).toBe((wrongPassword as Error).message);
  });

  it('still spends hashing time on a missing account (burns verifyPassword once)', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue(null);

    await expect(loginCustomer(input)).rejects.toThrow(BusinessRuleError);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });

  it('throws the same oracle-free message for a guest row without a password', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue({
      ...account,
      passwordHash: null,
      isBlocked: false,
    });

    await expect(loginCustomer(input)).rejects.toThrow(BusinessRuleError);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });

  it('rejects a blocked account with its own message, after password verifies', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue({
      ...account,
      passwordHash: 'scrypt$real-hash',
      isBlocked: true,
    });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await expect(loginCustomer(input)).rejects.toThrow('suspendida');
  });

  it('logs in and never returns passwordHash or isBlocked on the account', async () => {
    vi.mocked(customerRepository.findAuthByEmail).mockResolvedValue({
      ...account,
      passwordHash: 'scrypt$real-hash',
      isBlocked: false,
    });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await loginCustomer(input);

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('isBlocked');
    expect(createCustomerSession).toHaveBeenCalledWith('cust_1');
  });
});

describe('getCurrentCustomer', () => {
  it('returns null without hitting the repository when there is no session', async () => {
    vi.mocked(getCustomerSessionId).mockResolvedValue(null);

    await expect(getCurrentCustomer()).resolves.toBeNull();
    expect(customerRepository.findAccountById).not.toHaveBeenCalled();
  });

  it('re-checks the id against the DB (cookie can outlive a deleted row)', async () => {
    vi.mocked(getCustomerSessionId).mockResolvedValue('cust_1');
    vi.mocked(customerRepository.findAccountById).mockResolvedValue(null);

    await expect(getCurrentCustomer()).resolves.toBeNull();
  });

  it('returns the account when the session id still resolves', async () => {
    vi.mocked(getCustomerSessionId).mockResolvedValue('cust_1');
    vi.mocked(customerRepository.findAccountById).mockResolvedValue(account);

    await expect(getCurrentCustomer()).resolves.toEqual(account);
  });
});
