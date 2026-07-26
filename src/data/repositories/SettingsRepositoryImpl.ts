import { ISettingsRepository } from '@domain/repositories/ISettingsRepository';
import { AppSettings } from '@domain/entities/Settings';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { DatabaseService } from '@data/database/DatabaseService';
import { ThemeMode, LockType, AuthMethod } from '@core/constants';

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: ThemeMode.SYSTEM,
  authMethod: AuthMethod.PIN,
  lockType: LockType.AFTER_1M,
  isBiometricEnabled: false,
  screenCapturePrevention: true,
  autoLockEnabled: true,
  clipboardProtection: true,
  rootDetectionEnabled: false,
  secureDeleteEnabled: true,
  thumbnailQuality: 'medium',
  language: 'en',
  storagePath: '',
  autoBackupEnabled: false,
  autoBackupIntervalDays: 7,
};

/** Implementation of ISettingsRepository backed by the SQLite settings table. */
export class SettingsRepositoryImpl implements ISettingsRepository {
  constructor(private db: DatabaseService) {}

  /** Loads all settings from the database, falling back to defaults. */
  async get(): Promise<Result<AppSettings>> {
    try {
      const rows = await this.db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
      const storedMap = new Map(rows.map((r) => [r.key, r.value]));

      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        themeMode: (storedMap.get('themeMode') as ThemeMode) ?? DEFAULT_SETTINGS.themeMode,
        authMethod: (storedMap.get('authMethod') as AuthMethod) ?? DEFAULT_SETTINGS.authMethod,
        lockType: (storedMap.get('lockType') as LockType) ?? DEFAULT_SETTINGS.lockType,
        isBiometricEnabled: storedMap.get('isBiometricEnabled') === 'true',
        screenCapturePrevention: storedMap.get('screenCapturePrevention') !== 'false',
        autoLockEnabled: storedMap.get('autoLockEnabled') !== 'false',
        clipboardProtection: storedMap.get('clipboardProtection') !== 'false',
        rootDetectionEnabled: storedMap.get('rootDetectionEnabled') === 'true',
        secureDeleteEnabled: storedMap.get('secureDeleteEnabled') !== 'false',
        thumbnailQuality: (storedMap.get('thumbnailQuality') as AppSettings['thumbnailQuality']) ?? 'medium',
        language: storedMap.get('language') ?? 'en',
        storagePath: storedMap.get('storagePath') ?? '',
        autoBackupEnabled: storedMap.get('autoBackupEnabled') === 'true',
        autoBackupIntervalDays: parseInt(storedMap.get('autoBackupIntervalDays') ?? '7', 10),
      };

      return success(settings);
    } catch (error) {
      return success(DEFAULT_SETTINGS);
    }
  }

  /** Merges partial settings into the current stored settings and persists them. */
  async update(partial: Partial<AppSettings>): Promise<Result<void>> {
    try {
      const current = await this.get();
      if (!current.success) return failure(current.error);

      const merged = { ...current.data, ...partial };
      const entries: [string, string][] = Object.entries(merged).map(([key, value]) => [
        key,
        String(value),
      ]);

      await this.db.transaction(async () => {
        for (const [key, value] of entries) {
          await this.db.executeSql(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
            [key, value, this.db.now()],
          );
        }
      });

      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to update settings', (error as Error).message));
    }
  }

  /** Retrieves a single setting value by key. */
  async getValue(key: string): Promise<Result<string | null>> {
    try {
      const row = await this.db.queryOne<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [key],
      );
      return success(row?.value ?? null);
    } catch (error) {
      return failure(new DatabaseError('Failed to get setting value', (error as Error).message));
    }
  }

  /** Stores a single setting key-value pair. */
  async setValue(key: string, value: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, this.db.now()],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to set setting value', (error as Error).message));
    }
  }

  /** Returns a fresh copy of the default settings object. */
  getDefaults(): AppSettings {
    return { ...DEFAULT_SETTINGS };
  }
}
