import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { APP_CONFIG } from '@core/constants';
import { now, logger, withRetry } from '@core/utils';

/** Service managing the SQLite database connection, queries, transactions, and backups. */
export class DatabaseService {
  private db: SQLiteDatabase | null = null;
  private initialized = false;
  private dbPath: string | null = null;

  /** Opens the database and applies initial PRAGMA settings. */
  async initialize(password?: string): Promise<void> {
    const start = Date.now();
    this.db = openDatabaseSync(APP_CONFIG.database.name);
    this.dbPath = `${FileSystem.documentDirectory}SQLite/${APP_CONFIG.database.name}`;

    if (password) {
      this.db.runSync('PRAGMA key = ?', [password]);
    }

    this.db.execSync('PRAGMA journal_mode = WAL');
    this.db.execSync('PRAGMA synchronous = NORMAL');
    this.db.execSync('PRAGMA cache_size = -4000');
    this.db.execSync('PRAGMA temp_store = MEMORY');
    this.db.execSync('PRAGMA foreign_keys = ON');

    this.initialized = true;
    logger.info('Database initialized', { latencyMs: Date.now() - start });
  }

  private ensureInitialized(): void {
    if (!this.db || !this.initialized) {
      throw new Error('Database not initialized');
    }
  }

  /** Executes a write SQL statement with optional parameters. */
  async executeSql(sql: string, params?: unknown[]): Promise<void> {
    this.ensureInitialized();
    await withRetry(async () => { this.db!.runSync(sql, params as never); });
  }

  /** Queries multiple rows and returns them as an array of T. */
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    this.ensureInitialized();
    return withRetry(async () => this.db!.getAllSync(sql, params as never) as T[]);
  }

  /** Queries a single row and returns it as T or null. */
  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    this.ensureInitialized();
    return withRetry(async () => (this.db!.getFirstSync(sql, params as never) as T) ?? null);
  }

  /** Runs a callback inside a database transaction. */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.ensureInitialized();
    return withRetry(async () => {
      this.db!.runSync('BEGIN TRANSACTION');
      try {
        const result = await fn();
        this.db!.runSync('COMMIT');
        return result;
      } catch (error) {
        this.db!.runSync('ROLLBACK');
        throw error;
      }
    });
  }

  /** Closes the database connection. */
  async close(): Promise<void> {
    if (this.db) {
      this.db.closeSync();
      this.db = null;
      this.initialized = false;
      logger.info('Database closed');
    }
  }

  /** Returns the file-system path of the database file. */
  getDatabasePath(): string | null {
    return this.dbPath;
  }

  /** Returns the current user_version from PRAGMA. */
  async getVersion(): Promise<number> {
    this.ensureInitialized();
    const row = await this.queryOne<{ version: number }>('PRAGMA user_version');
    return row?.version ?? 0;
  }

  /** Sets the user_version via PRAGMA. */
  async setVersion(version: number): Promise<void> {
    this.ensureInitialized();
    this.db!.runSync('PRAGMA user_version = ?', [version]);
  }

  /** Runs an integrity check on the database and returns whether it passed. */
  async integrityCheck(): Promise<boolean> {
    try {
      const result = await this.queryOne<{ integrity_check: string }>('PRAGMA integrity_check');
      const ok = result?.integrity_check === 'ok';
      if (!ok) logger.warn('Database integrity check failed');
      return ok;
    } catch (error) {
      logger.error('Integrity check error', error as Error);
      return false;
    }
  }

  /** Copies the database file to a destination directory and returns the backup path. */
  async backup(destinationDir: string): Promise<string> {
    const sourcePath = this.getDatabasePath();
    if (!sourcePath) throw new Error('Cannot determine database path');

    const info = await FileSystem.getInfoAsync(sourcePath);
    if (!info.exists) throw new Error(`Database file not found at ${sourcePath}`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `khaznati-backup-${timestamp}.kzb`;
    const destPath = `${destinationDir}/${fileName}`;

    await FileSystem.makeDirectoryAsync(destinationDir, { intermediates: true });
    await FileSystem.copyAsync({ from: sourcePath, to: destPath });
    logger.info('Database backup completed', { destination: destPath, size: info.size });

    return destPath;
  }

  /** Restores the database from a backup file. */
  async restore(sourcePath: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(sourcePath);
    if (!info.exists) throw new Error(`Backup file not found at ${sourcePath}`);

    const destPath = this.getDatabasePath();
    if (!destPath) throw new Error('Cannot determine database path');

    await this.close();
    await FileSystem.copyAsync({ from: sourcePath, to: destPath });
    await this.initialize();
    logger.info('Database restored from backup', { source: sourcePath });
  }

  /** Returns the current timestamp from the shared time utility. */
  now(): number {
    return now();
  }
}
