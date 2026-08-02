import { ErrorCode, isAppError, type ErrorCodeValue } from '@/lib/errors';

/**
 * Discriminated result returned by every Server Action.
 *
 * Server Actions must return serialisable values, so throwing across the
 * boundary is not an option — errors are modelled as data instead.
 */
export type ActionSuccess<T> = {
  readonly ok: true;
  readonly data: T;
};

export type ActionFailure = {
  readonly ok: false;
  readonly code: ErrorCodeValue;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function fail(
  message: string,
  code: ErrorCodeValue = ErrorCode.INTERNAL,
  fieldErrors?: Record<string, string[]>,
): ActionFailure {
  return { ok: false, code, message, fieldErrors };
}

export function failFrom(error: unknown): ActionFailure {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code,
      message: error.isPublic
        ? error.message
        : 'Ocurrió un error inesperado. Inténtalo nuevamente.',
      fieldErrors: error.details,
    };
  }

  return fail('Ocurrió un error inesperado. Inténtalo nuevamente.');
}
