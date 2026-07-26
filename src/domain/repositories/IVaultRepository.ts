import { Vault } from '@domain/entities/Vault';
import { Result } from '@core/errors';

/** Repository interface for vault persistence operations. */
export interface IVaultRepository {
  /** Creates a new vault. */
  create(vault: Vault): Promise<Result<Vault>>;
  /** Finds a vault by its ID. */
  findById(id: string): Promise<Result<Vault | null>>;
  /** Retrieves all vaults. */
  findAll(): Promise<Result<Vault[]>>;
  /** Updates an existing vault. */
  update(vault: Vault): Promise<Result<Vault>>;
  /** Deletes a vault by its ID. */
  delete(id: string): Promise<Result<void>>;
  /** Updates the last-accessed timestamp of a vault. */
  updateLastAccessed(id: string): Promise<Result<void>>;
  /** Locks a vault, making its contents inaccessible. */
  lock(id: string): Promise<Result<void>>;
  /** Unlocks a vault, making its contents accessible. */
  unlock(id: string): Promise<Result<void>>;
  /** Returns the total number of vaults. */
  count(): Promise<Result<number>>;
}
