import { up as migration001Up, down as migration001Down } from '@data/database/migrations/001_initial';
import { SCHEMA } from '@data/database/schema';
import { DatabaseService } from '@data/database/DatabaseService';

/**
 * Regression tests for the schema bootstrap (RC-1).
 *
 * expo-sqlite cannot be exercised in jest (no native binding), so these tests
 * pin the *contract* that the initial migration sends the multi-statement
 * schema through a multi-statement execution path (`execSql` → `execSync`).
 * `runSync`/`executeSql` compiled only the first CREATE statement, silently
 * dropping `items`, `notes`, `passwords` and `activity_log`.
 */
class FakeDatabaseService {
  execCalled = false;
  execSource = '';
  executeSqlCalls: string[] = [];

  async execSql(sql: string): Promise<void> {
    this.execCalled = true;
    this.execSource = sql;
  }

  async executeSql(sql: string): Promise<void> {
    this.executeSqlCalls.push(sql);
  }
}

const EXPECTED_TABLES = ['vaults', 'items', 'notes', 'passwords', 'activity_log'];

describe('initial migration applies the full schema (RC-1 regression)', () => {
  let db: FakeDatabaseService;

  beforeEach(() => {
    db = new FakeDatabaseService();
  });

  it('up() uses the multi-statement execSql path, not single-statement executeSql', async () => {
    await migration001Up(db as unknown as DatabaseService);
    expect(db.execCalled).toBe(true);
    expect(db.executeSqlCalls).toHaveLength(0);
  });

  it('passes a schema that creates all five tables', async () => {
    await migration001Up(db as unknown as DatabaseService);
    for (const table of EXPECTED_TABLES) {
      expect(db.execSource).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('SCHEMA standalone contains all five CREATE TABLE statements', () => {
    for (const table of EXPECTED_TABLES) {
      expect(SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(SCHEMA).toContain('CREATE INDEX IF NOT EXISTS');
  });

  it('down() drops all five tables', async () => {
    await migration001Down(db as unknown as DatabaseService);
    expect(db.executeSqlCalls).toHaveLength(5);
    expect(db.executeSqlCalls.join(' ')).toContain('activity_log');
    expect(db.executeSqlCalls.join(' ')).toContain('vaults');
  });
});