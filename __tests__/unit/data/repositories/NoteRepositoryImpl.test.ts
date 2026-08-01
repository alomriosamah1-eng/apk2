import { NoteRepositoryImpl } from '@data/repositories/NoteRepositoryImpl';
import { Note } from '@domain/entities/Note';
import { NoteDTO } from '@data/dto/NoteDTO';
import { DatabaseService } from '@data/database/DatabaseService';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

jest.mock('expo-crypto');
jest.mock('expo-secure-store');

class FakeSecureStorage {
  private store = new Map<string, string>();
  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class FakeDatabaseService {
  rows: NoteDTO[] = [];
  now() {
    return 1700000000000;
  }
  async executeSql(sql: string, params?: unknown[]): Promise<void> {
    if (sql.trim().startsWith('INSERT INTO notes')) {
      this.rows.push({
        id: String(params?.[0]),
        vault_id: String(params?.[1]),
        title: String(params?.[2]),
        encrypted_content: String(params?.[3]),
        is_encrypted: Number(params?.[4]),
        color: params?.[5] as string | null,
        is_pinned: Number(params?.[6]),
        created_at: Number(params?.[7]),
        updated_at: Number(params?.[8]),
      });
    } else if (sql.trim().startsWith('DELETE FROM notes')) {
      this.rows = this.rows.filter((r) => r.id !== params?.[0]);
    } else if (sql.trim().startsWith('UPDATE notes SET is_pinned')) {
      const row = this.rows.find((r) => r.id === params?.[0]);
      if (row) row.is_pinned = row.is_pinned === 1 ? 0 : 1;
    } else if (sql.trim().startsWith('UPDATE notes')) {
      const id = params?.[params.length - 1];
      const row = this.rows.find((r) => r.id === id);
      if (row) {
        row.title = String(params?.[0]);
        row.encrypted_content = String(params?.[1]);
        row.is_encrypted = Number(params?.[2]);
        row.color = params?.[3] as string | null;
        row.is_pinned = Number(params?.[4]);
        row.updated_at = Number(params?.[5]);
      }
    }
  }
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    let rows = this.rows;
    if (sql.includes('WHERE vault_id = ?')) {
      rows = rows.filter((r) => r.vault_id === params?.[0]);
    }
    if (sql.includes('title LIKE ?')) {
      const q = String(params?.[1]).replace(/%/g, '');
      rows = rows.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));
    }
    return [...rows].sort((a, b) => (b.is_pinned - a.is_pinned) || (b.updated_at - a.updated_at)) as unknown as T[];
  }
  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const row = this.rows.find((r) => r.id === params?.[0]);
    return (row as unknown as T) ?? null;
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  vaultId: 'vault-1',
  title: 'Shopping list',
  encryptedContent: 'milk, eggs, bread',
  isEncrypted: false,
  color: null,
  isPinned: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  ...overrides,
});

describe('NoteRepositoryImpl (notes consistency, P2)', () => {
  let db: FakeDatabaseService;
  let secure: FakeSecureStorage;
  let repo: NoteRepositoryImpl;

  beforeEach(() => {
    db = new FakeDatabaseService();
    secure = new FakeSecureStorage();
    repo = new NoteRepositoryImpl(db as unknown as DatabaseService, secure as unknown as SecureStorageSource);
  });

  it('create + findByVaultId round-trips and decrypts content', async () => {
    const note = makeNote();
    const created = await repo.create(note);
    expect(created.success).toBe(true);

    const found = await repo.findByVaultId('vault-1');
    expect(found.success).toBe(true);
    if (found.success) {
      expect(found.data).toHaveLength(1);
      expect(found.data[0]!.title).toBe('Shopping list');
      expect(found.data[0]!.encryptedContent).toBe('milk, eggs, bread');
      expect(found.data[0]!.isEncrypted).toBe(true);
    }
  });

  it('update persists title/content changes', async () => {
    await repo.create(makeNote());

    const result = await repo.update(
      makeNote({ title: 'Updated', encryptedContent: 'only eggs', updatedAt: 1700000000001 }),
    );
    expect(result.success).toBe(true);

    const found = await repo.findById('note-1');
    expect(found.success).toBe(true);
    if (found.success && found.data) {
      expect(found.data.title).toBe('Updated');
      expect(found.data.encryptedContent).toBe('only eggs');
    }
  });

  it('togglePin flips the pinned flag', async () => {
    await repo.create(makeNote());
    await repo.togglePin('note-1');

    const pinned = await repo.findByVaultId('vault-1');
    expect(pinned.success).toBe(true);
    if (pinned.success) {
      expect(pinned.data[0]!.isPinned).toBe(true);
    }

    await repo.togglePin('note-1');
    const unpinned = await repo.findByVaultId('vault-1');
    expect(unpinned.success).toBe(true);
    if (unpinned.success) {
      expect(unpinned.data[0]!.isPinned).toBe(false);
    }
  });

  it('delete removes the note row', async () => {
    await repo.create(makeNote());
    const result = await repo.delete('note-1');
    expect(result.success).toBe(true);

    const found = await repo.findByVaultId('vault-1');
    expect(found.success && found.data.length).toBe(0);
  });
});
