import { AppSettings } from '@domain/entities/Settings';
import { Result } from '@core/errors';

/** Repository interface for app settings persistence operations. */
export interface ISettingsRepository {
  /** Retrieves all app settings. */
  get(): Promise<Result<AppSettings>>;
  /** Partially updates app settings. */
  update(settings: Partial<AppSettings>): Promise<Result<void>>;
  /** Retrieves a single setting value by key. */
  getValue(key: string): Promise<Result<string | null>>;
  /** Sets a single setting value by key. */
  setValue(key: string, value: string): Promise<Result<void>>;
}
