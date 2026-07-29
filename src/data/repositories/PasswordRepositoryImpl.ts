import { IPasswordRepository } from '@domain/repositories/IPasswordRepository';
import { PasswordEntry } from '@domain/entities/Password';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { PasswordDTO } from '@data/dto/PasswordDTO';
import { PasswordMapper } from '@data/mappers/PasswordMapper';
import { DatabaseService } from '@data/database/DatabaseService';
import { encryptData, decryptData, generateEncryptionKey } from '@core/utils/crypto';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { DIContainer } from '@core/di/container';

export class PasswordRepositoryImpl implements IPasswordRepository {
  private mapper = new PasswordMapper();

  constructor(private db: DatabaseService) {}

  private async getVaultKey(vaultId: string): Promise<string> {
    const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
    const keyKey = `pwd_vault_key_${vaultId}`;
    let key = await storage.get(keyKey);
    if (!key) {
      key = await generateEncryptionKey();
      await storage.set(keyKey, key);
    }
    return key;
  }

  async create(password: PasswordEntry): Promise<Result<PasswordEntry>> {
    try {
      const vaultKey = await this.getVaultKey(password.vaultId);
      const encryptedCipher = await encryptData(vaultKey, password.encryptedPassword);
      const dto = this.mapper.toDTO({ ...password, encryptedPassword: encryptedCipher });
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

  async findById(id: string): Promise<Result<PasswordEntry | null>> {
    try {
      const row = await this.db.queryOne<PasswordDTO>('SELECT * FROM passwords WHERE id = ?', [id]);
      if (!row) return success(null);
      const entry = this.mapper.toEntity(row);
      try {
        const vaultKey = await this.getVaultKey(entry.vaultId);
        entry.encryptedPassword = await decryptData(vaultKey, row.encrypted_password);
      } catch {
        entry.encryptedPassword = '[encrypted]';
      }
      return success(entry);
    } catch (error) {
      return failure(new DatabaseError('Failed to find password', (error as Error).message));
    }
  }

  async findByVaultId(vaultId: string): Promise<Result<PasswordEntry[]>> {
    try {
      const vaultKey = await this.getVaultKey(vaultId);
      const rows = await this.db.query<PasswordDTO>(
        'SELECT * FROM passwords WHERE vault_id = ? ORDER BY service_name ASC',
        [vaultId],
      );
      const entries = await Promise.all(rows.map(async (r) => {
        const entry = this.mapper.toEntity(r);
        try {
          entry.encryptedPassword = await decryptData(vaultKey, r.encrypted_password);
        } catch {
          entry.encryptedPassword = '[encrypted]';
        }
        return entry;
      }));
      return success(entries);
    } catch (error) {
      return failure(new DatabaseError('Failed to find passwords', (error as Error).message));
    }
  }

  async update(password: PasswordEntry): Promise<Result<PasswordEntry>> {
    try {
      const vaultKey = await this.getVaultKey(password.vaultId);
      const encryptedCipher = await encryptData(vaultKey, password.encryptedPassword);
      const dto = this.mapper.toDTO({ ...password, encryptedPassword: encryptedCipher });
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

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql('DELETE FROM passwords WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete password', (error as Error).message));
    }
  }

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
