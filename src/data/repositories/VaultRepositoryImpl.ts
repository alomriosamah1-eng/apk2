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
         last_accessed_at, is_locked, encrypted_pin_hash, pin_salt, item_count, total_size, backup_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.id, dto.name, dto.type, dto.icon, dto.color, dto.created_at, dto.updated_at,
         dto.last_accessed_at, dto.is_locked, dto.encrypted_pin_hash, dto.pin_salt,
         dto.item_count, dto.total_size, dto.backup_version],
      );
      return success(vault);
    } catch (error) {
      return failure(new DatabaseError('Failed to create vault', (error as Error).message));
    }
  }

  private readonly VAULT_COLUMNS = 'id, name, type, icon, color, created_at, updated_at, last_accessed_at, is_locked, encrypted_pin_hash, pin_salt, item_count, total_size, backup_version';

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
         last_accessed_at = ?, is_locked = ?, item_count = ?, total_size = ?
         WHERE id = ?`,
        [dto.name, dto.type, dto.icon, dto.color, dto.updated_at, dto.last_accessed_at,
         dto.is_locked, dto.item_count, dto.total_size, dto.id],
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
