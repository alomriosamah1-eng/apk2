/** Base domain error for all application-specific errors. */
export class DomainError extends Error {
  constructor(
    message: string,
    /** Error code used for programmatic identification. */
    public readonly code: string,
    /** Optional metadata payload with additional error context. */
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Error thrown when user authentication fails. */
export class AuthenticationError extends DomainError {
  constructor(reason: string) {
    super(`Authentication failed: ${reason}`, 'AUTH_FAILED', { reason });
  }
}

/** Error thrown when a database operation fails. */
export class DatabaseError extends DomainError {
  constructor(message: string, cause?: string) {
    super(message, 'DATABASE_ERROR', { cause });
  }
}

/** Error thrown when input validation fails. */
export class ValidationError extends DomainError {
  constructor(field: string, reason: string) {
    super(`Validation failed for ${field}: ${reason}`, 'VALIDATION_ERROR', {
      field,
      reason,
    });
  }
}

/** Discriminating error codes for crypto failures (Recovery/05 §5.16). */
export enum CryptoErrorCode {
  TAMPER = 'TAMPER',
  BAD_KEY = 'BAD_KEY',
  BAD_FORMAT = 'BAD_FORMAT',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
}

/** Error thrown when encryption/decryption fails. Never to be silently swallowed. */
export class CryptoError extends DomainError {
  constructor(code: CryptoErrorCode, message: string) {
    super(message, code, { reason: code });
    this.name = 'CryptoError';
  }
}

/** Discriminated union type representing either a successful result or a failure. */
export type Result<T, E = DomainError> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Creates a successful {@link Result}. */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/** Creates a failed {@link Result} with the given error. */
export function failure<T>(error: DomainError): Result<T> {
  return { success: false, error };
}
