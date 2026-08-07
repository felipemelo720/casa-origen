import { describe, expect, it } from 'vitest';
import { deriveAdminSessionToken } from './session-token';

describe('deriveAdminSessionToken', () => {
  it('derives a 64-char hex SHA-256 digest', async () => {
    const token = await deriveAdminSessionToken('correct horse battery staple');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same password', async () => {
    const a = await deriveAdminSessionToken('same-password');
    const b = await deriveAdminSessionToken('same-password');
    expect(a).toBe(b);
  });

  it('never leaks the password verbatim in the token', async () => {
    const token = await deriveAdminSessionToken('super-secret-password');
    expect(token).not.toContain('super-secret-password');
  });

  it('produces different tokens for different passwords', async () => {
    const a = await deriveAdminSessionToken('password-one');
    const b = await deriveAdminSessionToken('password-two');
    expect(a).not.toBe(b);
  });
});
