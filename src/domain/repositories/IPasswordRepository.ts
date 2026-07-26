import { PasswordEntry } from '@domain/entities/Password';
import { Result } from '@core/errors';

/** Repository interface for password entry persistence operations. */
export interface IPasswordRepository {
  /** Creates a new password entry. */
  create(password: PasswordEntry): Promise<Result<PasswordEntry>>;
  /** Finds a password entry by its ID. */
  findById(id: string): Promise<Result<PasswordEntry | null>>;
  /** Finds all password entries within a vault. */
  findByVaultId(vaultId: string): Promise<Result<PasswordEntry[]>>;
  /** Updates an existing password entry. */
  update(password: PasswordEntry): Promise<Result<PasswordEntry>>;
  /** Deletes a password entry by its ID. */
  delete(id: string): Promise<Result<void>>;
  /** Searches password entries within a vault matching a query string. */
  search(vaultId: string, query: string): Promise<Result<PasswordEntry[]>>;
  /** Updates the last-used timestamp of a password entry. */
  updateLastUsed(id: string): Promise<Result<void>>;
}
