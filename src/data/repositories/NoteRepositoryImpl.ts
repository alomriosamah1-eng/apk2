import { INoteRepository } from '@domain/repositories/INoteRepository';
import { Note } from '@domain/entities/Note';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { NoteDTO } from '@data/dto/NoteDTO';
import { NoteMapper } from '@data/mappers/NoteMapper';
import { DatabaseService } from '@data/database/DatabaseService';
import { encryptData, decryptData, generateEncryptionKey } from '@core/utils/crypto';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { DIContainer } from '@core/di/container';

export class NoteRepositoryImpl implements INoteRepository {
  private mapper = new NoteMapper();

  constructor(private db: DatabaseService) {}

  private async getVaultKey(vaultId: string): Promise<string> {
    const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
    const keyKey = `note_vault_key_${vaultId}`;
    let key = await storage.get(keyKey);
    if (!key) {
      key = await generateEncryptionKey();
      await storage.set(keyKey, key);
    }
    return key;
  }

  async create(note: Note): Promise<Result<Note>> {
    try {
      const vaultKey = await this.getVaultKey(note.vaultId);
      const encryptedContent = await encryptData(vaultKey, note.encryptedContent);
      const dto = this.mapper.toDTO({ ...note, encryptedContent });
      await this.db.executeSql(
        `INSERT INTO notes (id, vault_id, title, encrypted_content, is_encrypted, color, is_pinned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.id, dto.vault_id, dto.title, dto.encrypted_content, dto.is_encrypted,
         dto.color, dto.is_pinned, dto.created_at, dto.updated_at],
      );
      return success(note);
    } catch (error) {
      return failure(new DatabaseError('Failed to create note', (error as Error).message));
    }
  }

  async findById(id: string): Promise<Result<Note | null>> {
    try {
      const row = await this.db.queryOne<NoteDTO>('SELECT * FROM notes WHERE id = ?', [id]);
      if (!row) return success(null);
      return this.decryptNote(row);
    } catch (error) {
      return failure(new DatabaseError('Failed to find note', (error as Error).message));
    }
  }

  async findByVaultId(vaultId: string): Promise<Result<Note[]>> {
    try {
      const rows = await this.db.query<NoteDTO>(
        'SELECT * FROM notes WHERE vault_id = ? ORDER BY is_pinned DESC, updated_at DESC',
        [vaultId],
      );
      const notes = await Promise.all(rows.map((r) => this.decryptNote(r)));
      return success(notes.flatMap((n) => (n.success ? [n.data] : [])));
    } catch (error) {
      return failure(new DatabaseError('Failed to find notes', (error as Error).message));
    }
  }

  async update(note: Note): Promise<Result<Note>> {
    try {
      const vaultKey = await this.getVaultKey(note.vaultId);
      const encryptedContent = await encryptData(vaultKey, note.encryptedContent);
      const dto = this.mapper.toDTO({ ...note, encryptedContent });
      await this.db.executeSql(
        `UPDATE notes SET title = ?, encrypted_content = ?, is_encrypted = ?, color = ?,
         is_pinned = ?, updated_at = ? WHERE id = ?`,
        [dto.title, dto.encrypted_content, dto.is_encrypted, dto.color,
         dto.is_pinned, dto.updated_at, dto.id],
      );
      return success(note);
    } catch (error) {
      return failure(new DatabaseError('Failed to update note', (error as Error).message));
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql('DELETE FROM notes WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete note', (error as Error).message));
    }
  }

  async togglePin(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE notes SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = ?',
        [id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to toggle pin', (error as Error).message));
    }
  }

  async search(vaultId: string, query: string): Promise<Result<Note[]>> {
    try {
      const rows = await this.db.query<NoteDTO>(
        'SELECT * FROM notes WHERE vault_id = ? AND (title LIKE ?) ORDER BY updated_at DESC',
        [vaultId, `%${query}%`],
      );
      const notes = await Promise.all(rows.map((r) => this.decryptNote(r)));
      return success(notes.flatMap((n) => (n.success ? [n.data] : [])));
    } catch (error) {
      return failure(new DatabaseError('Failed to search notes', (error as Error).message));
    }
  }

  private async decryptNote(row: NoteDTO): Promise<Result<Note>> {
    const note = this.mapper.toEntity(row);
    try {
      const vaultKey = await this.getVaultKey(note.vaultId);
      note.encryptedContent = await decryptData(vaultKey, row.encrypted_content);
      note.isEncrypted = true;
    } catch {
      note.encryptedContent = '[encrypted]';
    }
    return success(note);
  }
}
