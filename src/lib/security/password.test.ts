import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { hashPassword, verifyPassword } from './password';

describe('hashPassword', () => {
  it('produces the scrypt$N$r$p$salt$hash format', async () => {
    const stored = await hashPassword('correct horse battery staple');
    const parts = stored.split('$');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1]).toBe('16384');
    expect(parts[2]).toBe('8');
    expect(parts[3]).toBe('1');
    expect(parts[4]).toMatch(/^[0-9a-f]{32}$/); // 16-byte salt
    expect(parts[5]).toMatch(/^[0-9a-f]{128}$/); // 64-byte key
  });

  it('uses a different salt each time, so two hashes of the same password differ', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('never leaks the password verbatim in the stored value', async () => {
    const stored = await hashPassword('super-secret-password');
    expect(stored).not.toContain('super-secret-password');
  });
});

describe('verifyPassword', () => {
  it('accepts the correct password against its own hash', async () => {
    const stored = await hashPassword('right-password');
    await expect(verifyPassword('right-password', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('right-password');
    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
  });

  it('rejects an empty password against a real hash', async () => {
    const stored = await hashPassword('right-password');
    await expect(verifyPassword('', stored)).resolves.toBe(false);
  });

  it('normalizes unicode (NFKC) so a composed and decomposed accent match', async () => {
    // 'é' as one codepoint vs 'e' + combining acute — same password, different bytes.
    const stored = await hashPassword('café');
    await expect(verifyPassword('café', stored)).resolves.toBe(true);
  });

  it('returns false, never throws, on a value with the wrong number of segments', async () => {
    await expect(verifyPassword('x', 'scrypt$16384$8$1$00')).resolves.toBe(false);
  });

  it('returns false on a value with the wrong algorithm tag', async () => {
    await expect(verifyPassword('x', 'bcrypt$16384$8$1$00$00')).resolves.toBe(false);
  });

  it('returns false when the cost parameters are not integers', async () => {
    await expect(verifyPassword('x', 'scrypt$abc$8$1$00$00')).resolves.toBe(false);
  });

  it('returns false on non-hex salt/hash instead of throwing', async () => {
    await expect(verifyPassword('x', 'scrypt$16384$8$1$zz$zz')).resolves.toBe(false);
  });

  it('returns false when salt or hash is empty', async () => {
    await expect(verifyPassword('x', 'scrypt$16384$8$1$$00')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$16384$8$1$00$')).resolves.toBe(false);
  });

  it('still resolves (does not hang) against the login-oracle placeholder hash', async () => {
    // Same fixed value customer-auth.service uses to burn hashing time on a
    // missing account, so a nonexistent email isn't a faster reply.
    await expect(verifyPassword('anything', 'scrypt$16384$8$1$00$00')).resolves.toBe(false);
  });
});
