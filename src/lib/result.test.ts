import { describe, expect, it } from 'vitest';
import { fail, failFrom, ok } from './result';
import { BusinessRuleError, ValidationError } from './errors';

describe('ok', () => {
  it('wraps data as a successful result', () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
  });
});

describe('fail', () => {
  it('defaults to INTERNAL_ERROR when no code is given', () => {
    const result = fail('algo salió mal');
    expect(result).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'algo salió mal',
      fieldErrors: undefined,
    });
  });

  it('carries field errors through', () => {
    const result = fail('inválido', 'VALIDATION_ERROR', { phone: ['Requerido'] });
    expect(result.fieldErrors).toEqual({ phone: ['Requerido'] });
  });
});

describe('failFrom', () => {
  it('surfaces a public AppError message and code verbatim', () => {
    const result = failFrom(new BusinessRuleError('El pedido mínimo es de 10000.'));
    expect(result).toEqual({
      ok: false,
      code: 'BUSINESS_RULE_VIOLATION',
      message: 'El pedido mínimo es de 10000.',
      fieldErrors: undefined,
    });
  });

  it('carries validation field errors through', () => {
    const result = failFrom(new ValidationError('Datos inválidos', { phone: ['Requerido'] }));
    expect(result.fieldErrors).toEqual({ phone: ['Requerido'] });
  });

  it('masks a non-AppError as a generic message, never leaking internals', () => {
    const result = failFrom(new Error('ECONNREFUSED 127.0.0.1:5435'));
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Ocurrió un error inesperado. Inténtalo nuevamente.');
    expect(result.message).not.toContain('ECONNREFUSED');
  });

  it('handles a thrown non-Error value', () => {
    const result = failFrom('just a string');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Ocurrió un error inesperado. Inténtalo nuevamente.');
  });
});
