import { IPasswordRepository } from '@domain/repositories/IPasswordRepository';
import { PasswordEntry } from '@domain/entities/Password';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { PasswordDTO } from '@data/dto/PasswordDTO';
import { PasswordMapper } from '@data/mappers/PasswordMapper';
import { DatabaseService } from '@data/database/DatabaseService';

/** Implementation of IPasswordRepository backed by SQLite via DatabaseService. */
export class PasswordRepositoryImpl implements IPasswordRepository {
  private mapper = new PasswordMapper();

  constructor(private db: DatabaseService) {}

  /** Inserts a new password record into the database. */
  async create(password: PasswordEntry): Promise<Result<PasswordEntry>> {
    try {
      const dto = this.mapper.toDTO(password);
      await this.db.executeSql(
        `INSERT INTO passwords (id, vault_id, service_name, service_url, username, encrypted_password, 
         category, notes, strength_score, created_at, updated_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.id, dto.vault_id, dto.service_name, dto.service_url, dto.username,
         dto.encrypted_password, dto.category, dto.notes, dto.strength_score,
         dto.created_at, dto.updated_at, dto.last_used_at],
      );
      return success(password);
    } catch (error) {
      return failure(new DatabaseError('Failed to create password entry', (error as Error).message));
    }
  }

  /** Finds a password entry by its ID, or null if not found. */
  async findById(id: string): Promise<Result<PasswordEntry | null>> {
    try {
      const row = await this.db.queryOne<PasswordDTO>('SELECT * FROM passwords WHERE id = ?', [id]);
      return success(row ? this.mapper.toEntity(row) : null);
    } catch (error) {
      return failure(new DatabaseError('Failed to find password', (error as Error).message));
    }
  }

  /** Finds all password entries in a vault, ordered alphabetically by service name. */
  async findByVaultId(vaultId: string): Promise<Result<PasswordEntry[]>> {
    try {
      const rows = await this.db.query<PasswordDTO>(
        'SELECT * FROM passwords WHERE vault_id = ? ORDER BY service_name ASC',
        [vaultId],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to find passwords', (error as Error).message));
    }
  }

  /** Updates an existing password record. */
  async update(password: PasswordEntry): Promise<Result<PasswordEntry>> {
    try {
      const dto = this.mapper.toDTO(password);
      await this.db.executeSql(
        `UPDATE passwords SET service_name = ?, service_url = ?, username = ?, encrypted_password = ?,
         category = ?, notes = ?, strength_score = ?, updated_at = ? WHERE id = ?`,
        [dto.service_name, dto.service_url, dto.username, dto.encrypted_password,
         dto.category, dto.notes, dto.strength_score, dto.updated_at, dto.id],
      );
      return success(password);
    } catch (error) {
      return failure(new DatabaseError('Failed to update password', (error as Error).message));
    }
  }

  /** Deletes a password entry by its ID. */
  async delete(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql('DELETE FROM passwords WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete password', (error as Error).message));
    }
  }

  /** Searches password entries by service name, username, or category. */
  async search(vaultId: string, query: string): Promise<Result<PasswordEntry[]>> {
    try {
      const rows = await this.db.query<PasswordDTO>(
        `SELECT * FROM passwords WHERE vault_id = ? AND 
         (service_name LIKE ? OR username LIKE ? OR category LIKE ?) 
         ORDER BY service_name ASC`,
        [vaultId, `%${query}%`, `%${query}%`, `%${query}%`],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to search passwords', (error as Error).message));
    }
  }

  /** Updates the last_used_at timestamp for a password entry. */
  async updateLastUsed(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE passwords SET last_used_at = ? WHERE id = ?',
        [this.db.now(), id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to update last used', (error as Error).message));
    }
  }
}
