import { ItemRepositoryImpl } from '@data/repositories/ItemRepositoryImpl';
import { Item } from '@domain/entities/Item';
import { ItemDTO } from '@data/dto/ItemDTO';
import { ItemType } from '@core/constants';
import { DatabaseService } from '@data/database/DatabaseService';
import { encryptFile, decryptFile, generateEncryptionKey } from '@core/utils/crypto';

jest.mock('expo-crypto');

class FakeDatabaseService {
  rows: ItemDTO[] = [];
  vaultCounts: { item_count: number; total_size: number } = { item_count: 0, total_size: 0 };

  now() {
    return 1700000000000;
  }

  async executeSql(sql: string, params?: unknown[]): Promise<void> {
    if (sql.trim().startsWith('INSERT INTO items')) {
      const dto = paramsToItemDTO(params);
      this.rows.push(dto);
    } else if (sql.trim().startsWith('DELETE FROM items')) {
      const id = params?.[0];
      this.rows = this.rows.filter((r) => r.id !== id);
    } else if (sql.trim().startsWith('UPDATE items')) {
      this.applyUpdate(sql, params);
    } else if (sql.trim().startsWith('UPDATE vaults')) {
      this.vaultCounts.item_count = Number(params?.[0]);
      this.vaultCounts.total_size = Number(params?.[1]);
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const rows = this.rows.filter((r) => {
      if (sql.includes('WHERE vault_id = ?')) {
        if (r.vault_id !== params?.[0]) return false;
      }
      if (sql.includes('WHERE id = ?')) {
        return r.id === params?.[0];
      }
      if (sql.includes('AND is_deleted = 0')) {
        if (r.is_deleted !== 0) return false;
      }
      if (sql.includes('name LIKE ?')) {
        const q = String(params?.[1] ?? '').replace(/%/g, '');
        if (!r.name.toLowerCase().includes(q.toLowerCase())) return false;
      }
      return true;
    });
    return rows as unknown as T[];
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    if (sql.includes('COUNT(*)')) {
      const count = this.rows.filter((r) => r.is_deleted === 0).length;
      return { count } as unknown as T;
    }
    if (sql.includes('COALESCE(SUM(size)')) {
      const total = this.rows.filter((r) => r.is_deleted === 0).reduce((sum, r) => sum + (r.size ?? 0), 0);
      return { total } as unknown as T;
    }
    const row = this.rows.find((r) => r.id === params?.[0]);
    return (row as unknown as T) ?? null;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  private applyUpdate(sql: string, params?: unknown[]): void {
    const id = params?.[params.length - 1];
    const row = this.rows.find((r) => r.id === id);
    if (!row) return;

    if (sql.includes('is_deleted = 1')) {
      row.is_deleted = 1;
      row.deleted_at = Number(params?.[1]) ?? null;
      return;
    }
    if (sql.includes('is_deleted = 0')) {
      row.is_deleted = 0;
      row.deleted_at = null;
      return;
    }
    if (sql.includes('parent_id = ?')) {
      row.parent_id = params?.[0] as string | null;
      return;
    }
    if (sql.includes('is_favorite = CASE')) {
      row.is_favorite = row.is_favorite === 1 ? 0 : 1;
      return;
    }
    // Full item update: [name,type,mime,size,path,data,thumb,meta,fav,del,updated,deleted,id]
    row.name = String(params?.[0]);
    row.type = String(params?.[1]);
    row.mime_type = params?.[2] as string | null;
    row.size = Number(params?.[3]);
    row.encrypted_path = params?.[4] as string | null;
    row.encrypted_data = params?.[5] as string | null;
    row.thumbnail_path = params?.[6] as string | null;
    row.metadata_json = params?.[7] as string | null;
    row.is_favorite = Number(params?.[8]);
    row.is_deleted = Number(params?.[9]);
    row.updated_at = Number(params?.[10]);
    row.deleted_at = params?.[11] as number | null;
  }
}

function paramsToItemDTO(params?: unknown[]): ItemDTO {
  return {
    id: String(params?.[0]),
    vault_id: String(params?.[1]),
    parent_id: params?.[2] as string | null,
    name: String(params?.[3]),
    type: String(params?.[4]),
    mime_type: params?.[5] as string | null,
    size: Number(params?.[6]),
    encrypted_path: params?.[7] as string | null,
    encrypted_data: params?.[8] as string | null,
    thumbnail_path: params?.[9] as string | null,
    metadata_json: params?.[10] as string | null,
    is_favorite: Number(params?.[11]),
    is_deleted: Number(params?.[12]),
    created_at: Number(params?.[13]),
    updated_at: Number(params?.[14]),
    deleted_at: params?.[15] as number | null,
  };
}

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  vaultId: 'vault-1',
  parentId: null,
  name: 'report.pdf',
  type: ItemType.FILE,
  mimeType: 'application/pdf',
  size: 1024,
  encryptedPath: 'khaznati/vault-1/1700000000000.report.pdf.enc',
  encryptedData: null,
  thumbnailPath: null,
  metadata: null,
  isFavorite: false,
  isDeleted: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  deletedAt: null,
  ...overrides,
});

describe('ItemRepositoryImpl (DB-first file consistency, P2)', () => {
  let db: FakeDatabaseService;
  let repo: ItemRepositoryImpl;

  beforeEach(() => {
    db = new FakeDatabaseService();
    repo = new ItemRepositoryImpl(db as unknown as DatabaseService);
  });

  it('create + findByVaultId round-trips an imported file row', async () => {
    const item = makeItem();
    const created = await repo.create(item);
    expect(created.success).toBe(true);

    const found = await repo.findByVaultId('vault-1');
    expect(found.success).toBe(true);
    if (found.success) {
      expect(found.data).toHaveLength(1);
      expect(found.data[0]!.id).toBe('item-1');
      expect(found.data[0]!.encryptedPath).toBe(item.encryptedPath);
      expect(found.data[0]!.type).toBe(ItemType.FILE);
    }
  });

  it('rename syncs name and encrypted_path on the DB row', async () => {
    await repo.create(makeItem());

    const result = await repo.update(
      makeItem({
        name: 'renamed.pdf',
        encryptedPath: 'khaznati/vault-1/1700000000000.renamed.pdf.enc',
        updatedAt: 1700000000001,
      }),
    );
    expect(result.success).toBe(true);

    const found = await repo.findById('item-1');
    expect(found.success).toBe(true);
    if (found.success && found.data) {
      expect(found.data.name).toBe('renamed.pdf');
      expect(found.data.encryptedPath).toBe('khaznati/vault-1/1700000000000.renamed.pdf.enc');
      expect(found.data.updatedAt).toBe(1700000000001);
    }
  });

  it('delete removes the DB row and updates vault counts', async () => {
    await repo.create(makeItem());
    const before = await repo.findByVaultId('vault-1');
    expect(before.success && before.data.length).toBe(1);

    const result = await repo.delete('item-1');
    expect(result.success).toBe(true);

    const after = await repo.findByVaultId('vault-1');
    expect(after.success && after.data.length).toBe(0);
    expect(db.vaultCounts.item_count).toBe(0);
    expect(db.vaultCounts.total_size).toBe(0);
  });

  it('import flow: encryptFile output stored as encrypted_path round-trips via decryptFile', async () => {
    const key = await generateEncryptionKey();
    const base64Data = Buffer.from('secret file contents').toString('base64');
    const encrypted = await encryptFile(key, base64Data);

    const item = makeItem({ encryptedPath: `khaznati/vault-1/import.enc`, size: encrypted.length });
    await repo.create(item);

    const decrypted = await decryptFile(key, encrypted);
    expect(Buffer.from(decrypted, 'base64').toString('utf-8')).toBe('secret file contents');
  });
});
