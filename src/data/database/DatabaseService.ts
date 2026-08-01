import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { APP_CONFIG } from '@core/constants';
import { now, logger, withRetry } from '@core/utils';
import { generateEncryptionKey } from '@core/utils/crypto';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

/** Database-at-rest encryption state (Recovery/09 §3, R3). */
export enum DatabaseEncryptionState {
  /** Full-file SQLCipher-style encryption is active. */
  ENCRYPTED = 'encrypted',
  /** Driver does not support whole-file encryption (expo-sqlite); field-level is used instead. */
  FIELD_ENCRYPTED = 'field-encrypted',
  /** No encryption surface at the DB layer; secrets rely on field-level crypto. */
  PLAINTEXT = 'plaintext',
  /** State not yet determined. */
  UNKNOWN = 'unknown',
}

/** Service managing the SQLite database connection, queries, transactions, and backups. */
export class DatabaseService {
  private db: SQLiteDatabase | null = null;
  private initialized = false;
  private dbPath: string | null = null;
  private encryptionState: DatabaseEncryptionState = DatabaseEncryptionState.UNKNOWN;

  /** Opens the database and applies initial PRAGMA settings. */
  async initialize(password?: string): Promise<void> {
    const start = Date.now();
    this.db = openDatabaseSync(APP_CONFIG.database.name);
    this.dbPath = `${FileSystem.documentDirectory}SQLite/${APP_CONFIG.database.name}`;

    if (!password) {
      const storage = new SecureStorageSource();
      const storedKey = await storage.get('db_encryption_key');
      if (storedKey) {
        password = storedKey;
      } else {
        password = await generateEncryptionKey();
        await storage.set('db_encryption_key', password);
      }
    }

    this.encryptionState = DatabaseEncryptionState.UNKNOWN;
    try {
      this.db.runSync('PRAGMA key = ?', [password]);
      // SQLCipher silently accepts unknown PRAGMAs in some builds; we only trust
      // the state if a real cipher mode is reported.
      const cipher = this.db.getFirstSync<{ cipher: string | null }>(
        'PRAGMA cipher_version',
      );
      this.encryptionState = cipher
        ? DatabaseEncryptionState.ENCRYPTED
        : DatabaseEncryptionState.PLAINTEXT;
    } catch {
      // expo-sqlite does not ship SQLCipher: whole-file encryption is unsupported.
      this.encryptionState = DatabaseEncryptionState.FIELD_ENCRYPTED;
      logger.warn(
        'Database whole-file encryption is NOT supported by expo-sqlite. ' +
        'Secrets rely on field-level AES-256-GCM encryption. See Recovery/09 §3 (R3).',
      );
    }

    this.db.execSync('PRAGMA journal_mode = WAL');
    this.db.execSync('PRAGMA synchronous = NORMAL');
    this.db.execSync('PRAGMA cache_size = -4000');
    this.db.execSync('PRAGMA temp_store = MEMORY');
    this.db.execSync('PRAGMA foreign_keys = ON');

    this.initialized = true;
    logger.info('Database initialized', {
      latencyMs: Date.now() - start,
      encryptionState: this.encryptionState,
    });
  }

  /** Returns the resolved at-rest encryption state of the database. */
  getEncryptionState(): DatabaseEncryptionState {
    return this.encryptionState;
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

  /** Returns the current timestamp from the shared time utility. */
  now(): number {
    return now();
  }
}
