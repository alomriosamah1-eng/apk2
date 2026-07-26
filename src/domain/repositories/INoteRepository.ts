import { Note } from '@domain/entities/Note';
import { Result } from '@core/errors';

/** Repository interface for note persistence operations. */
export interface INoteRepository {
  /** Creates a new note. */
  create(note: Note): Promise<Result<Note>>;
  /** Finds a note by its ID. */
  findById(id: string): Promise<Result<Note | null>>;
  /** Finds all notes within a vault. */
  findByVaultId(vaultId: string): Promise<Result<Note[]>>;
  /** Updates an existing note. */
  update(note: Note): Promise<Result<Note>>;
  /** Deletes a note by its ID. */
  delete(id: string): Promise<Result<void>>;
  /** Toggles the pinned status of a note. */
  togglePin(id: string): Promise<Result<void>>;
  /** Searches notes within a vault matching a query string. */
  search(vaultId: string, query: string): Promise<Result<Note[]>>;
}
