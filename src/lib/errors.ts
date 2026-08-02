/**
 * Application error hierarchy.
 *
 * Every thrown error carries an HTTP status and a stable machine-readable
 * code, so the presentation layer never has to string-match a message.
 */

export const ErrorCode = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  BUSINESS_RULE: 'BUSINESS_RULE_VIOLATION',
  INTERNAL: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  /** Safe to render verbatim in the UI. */
  readonly isPublic: boolean;

  constructor(
    message: string,
    options: {
      code?: ErrorCodeValue;
      status?: number;
      details?: Record<string, string[]>;
      isPublic?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code ?? ErrorCode.INTERNAL;
    this.status = options.status ?? 500;
    this.details = options.details;
    this.isPublic = options.isPublic ?? true;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Los datos enviados no son válidos.', details?: Record<string, string[]>) {
    super(message, { code: ErrorCode.VALIDATION, status: 422, details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Debes iniciar sesión para continuar.') {
    super(message, { code: ErrorCode.UNAUTHENTICATED, status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta acción.') {
    super(message, { code: ErrorCode.FORBIDDEN, status: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'El recurso solicitado') {
    super(`${resource} no existe.`, { code: ErrorCode.NOT_FOUND, status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe.') {
    super(message, { code: ErrorCode.CONFLICT, status: 409 });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Demasiadas solicitudes. Inténtalo nuevamente en unos momentos.', {
      code: ErrorCode.RATE_LIMITED,
      status: 429,
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Rule of the domain was violated (e.g. ordering while the shop is closed). */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, { code: ErrorCode.BUSINESS_RULE, status: 409 });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Narrows any thrown value into a message safe to show to an end user. */
export function toPublicMessage(error: unknown): string {
  if (isAppError(error) && error.isPublic) return error.message;
  return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
}
