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

/** Error thrown when a requested vault does not exist. */
export class VaultNotFoundError extends DomainError {
  constructor(vaultId: string) {
    super(`Vault ${vaultId} not found`, 'VAULT_NOT_FOUND', { vaultId });
  }
}

/** Error thrown when a requested item does not exist. */
export class ItemNotFoundError extends DomainError {
  constructor(itemId: string) {
    super(`Item ${itemId} not found`, 'ITEM_NOT_FOUND', { itemId });
  }
}

/** Error thrown when user authentication fails. */
export class AuthenticationError extends DomainError {
  constructor(reason: string) {
    super(`Authentication failed: ${reason}`, 'AUTH_FAILED', { reason });
  }
}

/** Error thrown when an encryption operation fails. */
export class EncryptionError extends DomainError {
  constructor(cause: string) {
    super(`Encryption failed: ${cause}`, 'ENCRYPTION_FAILED', { cause });
  }
}

/** Error thrown when a decryption operation fails. */
export class DecryptionError extends DomainError {
  constructor(cause: string) {
    super(`Decryption failed: ${cause}`, 'DECRYPTION_FAILED', { cause });
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

/** Error thrown when a backup or restore operation fails. */
export class BackupError extends DomainError {
  constructor(message: string, cause?: string) {
    super(message, 'BACKUP_ERROR', { cause });
  }
}

/** Error thrown when the user lacks the required permission. */
export class PermissionError extends DomainError {
  constructor(permission: string) {
    super(`Permission denied: ${permission}`, 'PERMISSION_DENIED', { permission });
  }
}

/** Error thrown when a storage operation fails. */
export class StorageError extends DomainError {
  constructor(message: string, cause?: string) {
    super(message, 'STORAGE_ERROR', { cause });
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
