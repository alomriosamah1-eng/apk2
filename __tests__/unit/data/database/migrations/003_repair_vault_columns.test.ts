import { DatabaseService } from '@data/database/DatabaseService';
import { up as migration003Up } from '@data/database/migrations/003_repair_vault_columns';

describe('003_repair_vault_columns', () => {
  let db: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    db = {
      query: jest.fn(),
      executeSql: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;
  });

  it('adds missing failed_attempts column to an old vaults table', async () => {
    const existingColumns = [
      { name: 'id' },
      { name: 'name' },
      { name: 'type' },
      { name: 'icon' },
      { name: 'color' },
      { name: 'created_at' },
      { name: 'updated_at' },
      { name: 'last_accessed_at' },
      { name: 'is_locked' },
      { name: 'encrypted_pin_hash' },
      { name: 'pin_salt' },
    ];
    (db.query as jest.Mock).mockResolvedValue(existingColumns);

    await migration003Up(db);

    const alters = (db.executeSql as jest.Mock).mock.calls.map((c) => c[0]);
    expect(alters).toContain('ALTER TABLE vaults ADD COLUMN failed_attempts INTEGER DEFAULT 0');
    expect(alters).toContain('ALTER TABLE vaults ADD COLUMN locked_until INTEGER');
    expect(alters).toContain('ALTER TABLE vaults ADD COLUMN item_count INTEGER DEFAULT 0');
    expect(alters).toContain('ALTER TABLE vaults ADD COLUMN total_size INTEGER DEFAULT 0');
  });

  it('does nothing when the table already has all columns', async () => {
    const existingColumns = [
      { name: 'id' },
      { name: 'failed_attempts' },
      { name: 'locked_until' },
      { name: 'item_count' },
      { name: 'total_size' },
      { name: 'last_accessed_at' },
    ];
    (db.query as jest.Mock).mockResolvedValue(existingColumns);

    await migration003Up(db);

    expect(db.executeSql).not.toHaveBeenCalled();
  });
});
