import { DatabaseService } from '../DatabaseService';

/**
 * Expected columns per table. Older builds created `vaults` (and friends)
 * without the full column set, and `CREATE TABLE IF NOT EXISTS` never alters
 * an existing table. This migration adds any missing columns so every table
 * matches the current {@link SCHEMA}. It is idempotent.
 */
const EXPECTED_COLUMNS: Record<string, Array<[string, string]>> = {
  vaults: [
    ['failed_attempts', 'INTEGER DEFAULT 0'],
    ['locked_until', 'INTEGER'],
    ['item_count', 'INTEGER DEFAULT 0'],
    ['total_size', 'INTEGER DEFAULT 0'],
    ['last_accessed_at', 'INTEGER'],
  ],
};

async function tableColumns(db: DatabaseService, table: string): Promise<Set<string>> {
  const rows = await db.query<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((r) => r.name));
}

async function ensureTableColumns(db: DatabaseService, table: string): Promise<void> {
  const existing = await tableColumns(db, table);
  const expected = EXPECTED_COLUMNS[table] ?? [];
  for (const [column, definition] of expected) {
    if (!existing.has(column)) {
      await db.executeSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

/** Adds columns missing from tables created by older builds. */
export async function up(db: DatabaseService): Promise<void> {
  for (const table of Object.keys(EXPECTED_COLUMNS)) {
    await ensureTableColumns(db, table);
  }
}

/** Column additions are non-destructive; nothing to revert. */
export async function down(_db: DatabaseService): Promise<void> {
  // SQLite cannot drop columns reliably across versions; intentionally a no-op.
}
