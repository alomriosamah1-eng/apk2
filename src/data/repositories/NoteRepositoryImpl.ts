import { INoteRepository } from '@domain/repositories/INoteRepository';
import { Note } from '@domain/entities/Note';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { NoteDTO } from '@data/dto/NoteDTO';
import { NoteMapper } from '@data/mappers/NoteMapper';
import { DatabaseService } from '@data/database/DatabaseService';

/** Implementation of INoteRepository backed by SQLite via DatabaseService. */
export class NoteRepositoryImpl implements INoteRepository {
  private mapper = new NoteMapper();

  constructor(private db: DatabaseService) {}

  /** Inserts a new note record into the database. */
  async create(note: Note): Promise<Result<Note>> {
    try {
      const dto = this.mapper.toDTO(note);
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

  /** Finds a note by its ID, or null if not found. */
  async findById(id: string): Promise<Result<Note | null>> {
    try {
      const row = await this.db.queryOne<NoteDTO>('SELECT * FROM notes WHERE id = ?', [id]);
      return success(row ? this.mapper.toEntity(row) : null);
    } catch (error) {
      return failure(new DatabaseError('Failed to find note', (error as Error).message));
    }
  }

  /** Finds all notes in a vault, ordered by pinned status then updated date. */
  async findByVaultId(vaultId: string): Promise<Result<Note[]>> {
    try {
      const rows = await this.db.query<NoteDTO>(
        'SELECT * FROM notes WHERE vault_id = ? ORDER BY is_pinned DESC, updated_at DESC',
        [vaultId],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to find notes', (error as Error).message));
    }
  }

  /** Updates an existing note record. */
  async update(note: Note): Promise<Result<Note>> {
    try {
      const dto = this.mapper.toDTO(note);
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

  /** Deletes a note by its ID. */
  async delete(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql('DELETE FROM notes WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete note', (error as Error).message));
    }
  }

  /** Toggles the pinned flag on a note. */
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

  /** Searches notes by title or content within a vault. */
  async search(vaultId: string, query: string): Promise<Result<Note[]>> {
    try {
      const rows = await this.db.query<NoteDTO>(
        'SELECT * FROM notes WHERE vault_id = ? AND (title LIKE ? OR encrypted_content LIKE ?) ORDER BY updated_at DESC',
        [vaultId, `%${query}%`, `%${query}%`],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to search notes', (error as Error).message));
    }
  }
}
