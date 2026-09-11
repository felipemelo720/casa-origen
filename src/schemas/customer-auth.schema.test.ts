import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from './customer-auth.schema';

const validRegister = {
  firstName: 'Ana',
  lastName: 'Soto',
  email: 'ana@example.com',
  phone: '+56911112222',
  password: 'correct horse',
};

describe('registerSchema', () => {
  it('accepts valid input', () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });

  it('rejects a password under 8 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'short' });
    expect(result.success).toBe(false);
  });

  it('accepts an 8-character password with no symbol or uppercase (no composition theatre)', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'password' });
    expect(result.success).toBe(true);
  });

  it('rejects a password over 128 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'x'.repeat(129) });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...validRegister, email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('rejects a phone with letters', () => {
    expect(registerSchema.safeParse({ ...validRegister, phone: 'abc-not-a-phone' }).success).toBe(
      false,
    );
  });

  it('accepts a phone with spaces, parens and a leading +', () => {
    const result = registerSchema.safeParse({ ...validRegister, phone: '+56 (9) 1111-2222' });
    expect(result.success).toBe(true);
  });

  it('rejects a one-letter first or last name', () => {
    expect(registerSchema.safeParse({ ...validRegister, firstName: 'A' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, lastName: 'A' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts an email and password with no name/phone fields required', () => {
    const result = loginSchema.safeParse({ email: 'ana@example.com', password: 'whatever1' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing password', () => {
    expect(loginSchema.safeParse({ email: 'ana@example.com' }).success).toBe(false);
  });

  it('shares the same email rule as registerSchema', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: 'whatever1' });
    expect(result.success).toBe(false);
  });
});
