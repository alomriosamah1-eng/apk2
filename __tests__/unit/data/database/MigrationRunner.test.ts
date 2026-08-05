import { MigrationRunner } from '@data/database/MigrationRunner';
import { DatabaseService } from '@data/database/DatabaseService';
import { up as migration001Up } from '@data/database/migrations/001_initial';
import { up as migration002Up } from '@data/database/migrations/002_indexes';

/**
 * Regression test for the pre-fix device state (RC-1).
 *
 * Under the old buggy code, migration 001 was *recorded* as applied (user_version
 * and _migrations row) but only `vaults` was actually created (runSync executes
 * a single statement). The runner must bootstrap the full idempotent schema
 * before checking versions so migration 002's `CREATE INDEX ... ON items(...)`
 * never runs against a missing table.
 */
class FakeDatabaseService {
  version = 1;
  executed: string[] = [];
  execCalls: string[] = [];
  migrationsRows: { version: number }[] = [{ version: 1 }];
  tables: Set<string> = new Set(['vaults']);

  async execSql(sql: string): Promise<void> {
    this.execCalls.push(sql);
    if (sql.includes('CREATE TABLE IF NOT EXISTS items')) this.tables.add('items');
    if (sql.includes('CREATE TABLE IF NOT EXISTS notes')) this.tables.add('notes');
    if (sql.includes('CREATE TABLE IF NOT EXISTS passwords')) this.tables.add('passwords');
    if (sql.includes('CREATE TABLE IF NOT EXISTS activity_log')) this.tables.add('activity_log');
  }

  async executeSql(sql: string): Promise<void> {
    this.executed.push(sql);
    if (sql.includes('CREATE TABLE IF NOT EXISTS _migrations')) return;
    if (sql.startsWith('CREATE INDEX')) {
      for (const t of ['items', 'activity_log', 'vaults']) {
        if (!this.tables.has(t)) {
          throw new Error(`no such table: main.${t}`);
        }
      }
    }
    if (sql.includes('INSERT OR IGNORE INTO _migrations')) {
      this.migrationsRows.push({ version: 2 });
    }
  }

  async getVersion(): Promise<number> {
    return this.version;
  }

  async setVersion(v: number): Promise<void> {
    this.version = v;
  }

  async query<T>(sql: string): Promise<T[]> {
    if (sql.includes('SELECT COALESCE(MAX(version)')) {
      return [{ version: this.migrationsRows.length }] as unknown as T[];
    }
    return [] as unknown as T[];
  }
}

describe('MigrationRunner self-healing bootstrap (RC-1 device-state regression)', () => {
  it('creates all tables via execSql even when migration 001 is marked applied', async () => {
    const db = new FakeDatabaseService();
    const runner = new MigrationRunner();
    runner.register({ version: 1, name: '001_initial', up: migration001Up, down: async () => {} });
    runner.register({ version: 2, name: '002_indexes', up: migration002Up, down: async () => {} });

    await runner.run(db as unknown as DatabaseService);

    expect(db.tables.has('items')).toBe(true);
    expect(db.tables.has('notes')).toBe(true);
    expect(db.tables.has('passwords')).toBe(true);
    expect(db.tables.has('activity_log')).toBe(true);
    expect(db.execCalls.length).toBeGreaterThan(0);
  });

  it('runs migration 002 without throwing once the schema is bootstrapped', async () => {
    const db = new FakeDatabaseService();
    const runner = new MigrationRunner();
    runner.register({ version: 1, name: '001_initial', up: migration001Up, down: async () => {} });
    runner.register({ version: 2, name: '002_indexes', up: migration002Up, down: async () => {} });

    await expect(runner.run(db as unknown as DatabaseService)).resolves.toBeUndefined();
  });
});