import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Vault } from '@domain/entities/Vault';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { VaultDTO } from '@data/dto/VaultDTO';
import { VaultMapper } from '@data/mappers/VaultMapper';
import { DatabaseService } from '@data/database/DatabaseService';

/** Implementation of IVaultRepository backed by SQLite via DatabaseService. */
export class VaultRepositoryImpl implements IVaultRepository {
  private mapper = new VaultMapper();

  constructor(private db: DatabaseService) {}

  /** Inserts a new vault record into the database. */
  async create(vault: Vault): Promise<Result<Vault>> {
    try {
      const dto = this.mapper.toDTO(vault);
      await this.db.executeSql(
        `INSERT INTO vaults (id, name, type, icon, color, created_at, updated_at, 
         last_accessed_at, is_locked, encrypted_pin_hash, pin_salt, failed_attempts, locked_until, item_count, total_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.id, dto.name, dto.type, dto.icon, dto.color, dto.created_at, dto.updated_at,
         dto.last_accessed_at, dto.is_locked, dto.encrypted_pin_hash, dto.pin_salt,
         dto.failed_attempts, dto.locked_until, dto.item_count, dto.total_size],
      );
      return success(vault);
    } catch (error) {
      return failure(new DatabaseError('Failed to create vault', (error as Error).message));
    }
  }

  private readonly VAULT_COLUMNS = 'id, name, type, icon, color, created_at, updated_at, last_accessed_at, is_locked, encrypted_pin_hash, pin_salt, failed_attempts, locked_until, item_count, total_size';

  /** Finds a vault by its ID, or null if not found. */
  async findById(id: string): Promise<Result<Vault | null>> {
    try {
      const row = await this.db.queryOne<VaultDTO>(`SELECT ${this.VAULT_COLUMNS} FROM vaults WHERE id = ?`, [id]);
      return success(row ? this.mapper.toEntity(row) : null);
    } catch (error) {
      return failure(new DatabaseError('Failed to find vault', (error as Error).message));
    }
  }

  /** Returns all vaults ordered by creation date descending. */
  async findAll(): Promise<Result<Vault[]>> {
    try {
      const rows = await this.db.query<VaultDTO>(`SELECT ${this.VAULT_COLUMNS} FROM vaults ORDER BY created_at DESC`);
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to fetch vaults', (error as Error).message));
    }
  }

  /** Updates an existing vault record. */
  async update(vault: Vault): Promise<Result<Vault>> {
    try {
      const dto = this.mapper.toDTO(vault);
      await this.db.executeSql(
        `UPDATE vaults SET name = ?, type = ?, icon = ?, color = ?, updated_at = ?, 
         last_accessed_at = ?, is_locked = ?, encrypted_pin_hash = ?, pin_salt = ?, failed_attempts = ?, locked_until = ?, item_count = ?, total_size = ?
         WHERE id = ?`,
        [dto.name, dto.type, dto.icon, dto.color, dto.updated_at, dto.last_accessed_at,
         dto.is_locked, dto.encrypted_pin_hash, dto.pin_salt, dto.failed_attempts,
         dto.locked_until, dto.item_count, dto.total_size, dto.id],
      );
      return success(vault);
    } catch (error) {
      return failure(new DatabaseError('Failed to update vault', (error as Error).message));
    }
  }

  /** Deletes a vault by its ID. */
  async delete(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql('DELETE FROM vaults WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete vault', (error as Error).message));
    }
  }

  /** Updates the last_accessed_at timestamp for a vault. */
  async updateLastAccessed(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE vaults SET last_accessed_at = ? WHERE id = ?',
        [this.db.now(), id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to update last accessed', (error as Error).message));
    }
  }

  /** Marks a vault as locked. */
  async lock(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql('UPDATE vaults SET is_locked = 1 WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to lock vault', (error as Error).message));
    }
  }

  /** Marks a vault as unlocked and updates last accessed timestamp. */
  async unlock(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE vaults SET is_locked = 0, last_accessed_at = ? WHERE id = ?',
        [this.db.now(), id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to unlock vault', (error as Error).message));
    }
  }

  /** Updates specific fields of a vault by ID. */
  async updateFields(id: string, fields: Partial<Pick<Vault, 'failedAttempts' | 'lockedUntil'>>): Promise<Result<void>> {
    try {
      const assignments: string[] = [];
      const values: unknown[] = [];
      if (fields.failedAttempts !== undefined) {
        assignments.push('failed_attempts = ?');
        values.push(fields.failedAttempts);
      }
      if (fields.lockedUntil !== undefined) {
        assignments.push('locked_until = ?');
        values.push(fields.lockedUntil);
      } else if (fields.failedAttempts !== undefined && fields.failedAttempts === 0) {
        assignments.push('locked_until = ?');
        values.push(null);
      }
      if (assignments.length === 0) return success(undefined);
      values.push(id);
      await this.db.executeSql(
        `UPDATE vaults SET ${assignments.join(', ')} WHERE id = ?`,
        values,
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to update vault fields', (error as Error).message));
    }
  }

  /** Returns the total number of vaults. */
  async count(): Promise<Result<number>> {
    try {
      const row = await this.db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM vaults');
      return success(row?.count ?? 0);
    } catch (error) {
      return failure(new DatabaseError('Failed to count vaults', (error as Error).message));
    }
  }
}
