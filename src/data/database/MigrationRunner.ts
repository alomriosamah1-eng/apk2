import { DatabaseService } from './DatabaseService';

/** Describes a single database migration with up and down functions. */
interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseService) => Promise<void>;
  down: (db: DatabaseService) => Promise<void>;
}

/** Manages registering and running database migrations. */
export class MigrationRunner {
  private migrations: Migration[] = [];

  /** Registers a migration to be run by this runner. */
  register(migration: Migration): void {
    this.migrations.push(migration);
  }

  /** Runs pending migrations up to the target version, or reverts if lower than current. */
  async run(db: DatabaseService, targetVersion?: number): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const currentVersion = await db.getVersion();
    const maxVersion = targetVersion ?? this.migrations.length;

    this.migrations.sort((a, b) => a.version - b.version);

    if (currentVersion < maxVersion) {
      for (const migration of this.migrations) {
        if (migration.version > currentVersion && migration.version <= maxVersion) {
          await migration.up(db);
          await db.executeSql(
            'INSERT INTO _migrations (version, name) VALUES (?, ?)',
            [migration.version, migration.name],
          );
          await db.setVersion(migration.version);
        }
      }
    } else if (currentVersion > maxVersion) {
      for (const migration of [...this.migrations].reverse()) {
        if (migration.version <= currentVersion && migration.version > maxVersion) {
          await migration.down(db);
          await db.executeSql('DELETE FROM _migrations WHERE version = ?', [migration.version]);
          await db.setVersion(migration.version - 1);
        }
      }
    }
  }

  /** Returns the current migration version and the status of each registered migration. */
  async getStatus(db: DatabaseService): Promise<{ version: number; migrations: { version: number; name: string; applied: boolean }[] }> {
    const currentVersion = await db.getVersion();
    const applied = await db.query<{ version: number; name: string }>('SELECT version, name FROM _migrations ORDER BY version');
    const appliedVersions = new Set(applied.map((m) => m.version));

    return {
      version: currentVersion,
      migrations: this.migrations.map((m) => ({
        version: m.version,
        name: m.name,
        applied: appliedVersions.has(m.version),
      })),
    };
  }
}
