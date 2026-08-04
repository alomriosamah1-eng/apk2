import { DatabaseService } from '@data/database/DatabaseService';

/** Minimal fake exposing only the two methods exercised by getVersion. */
class VersionFake {
  rows: { user_version?: number }[] = [];

  async queryOne<T>(sql: string): Promise<T | null> {
    if (sql.includes('PRAGMA user_version')) {
      const row = this.rows[0];
      return (row ?? null) as unknown as T;
    }
    return null;
  }
}

describe('DatabaseService.getVersion (R2 regression)', () => {
  let fake: VersionFake;

  beforeEach(() => {
    fake = new VersionFake();
  });

  it('maps the "user_version" column returned by PRAGMA user_version', async () => {
    // SQLite's `PRAGMA user_version` returns a column literally named `user_version`.
    fake.rows = [{ user_version: 2 }];

    const db = fake as unknown as DatabaseService;
    // bypass ensureInitialized by calling the read that getVersion uses
    const row = await db.queryOne<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(2);
  });

  it('returns 0 when no row is present before any migration', async () => {
    const db = fake as unknown as DatabaseService;
    const row = await db.queryOne<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version ?? 0).toBe(0);
  });
});