import { ThemeMode, LockType, AuthMethod } from '@core/constants';

/** Represents the application-wide settings. */
export interface AppSettings {
  /** UI theme mode (light, dark, or system). */
  themeMode: ThemeMode;
  /** Authentication method (e.g. PIN, password, biometric). */
  authMethod: AuthMethod;
  /** Lock type (e.g. immediate, timeout-based). */
  lockType: LockType;
  /** Whether biometric authentication is enabled. */
  isBiometricEnabled: boolean;
  /** Whether screen capture is prevented. */
  screenCapturePrevention: boolean;
  /** Whether auto-lock is enabled. */
  autoLockEnabled: boolean;
  /** Whether clipboard content is protected (cleared after copy). */
  clipboardProtection: boolean;
  /** Whether root/jailbreak detection is enabled. */
  rootDetectionEnabled: boolean;
  /** Whether secure file deletion is enabled. */
  secureDeleteEnabled: boolean;
  /** Quality level for thumbnail generation. */
  thumbnailQuality: 'low' | 'medium' | 'high';
  /** Application language locale. */
  language: string;
  /** Base path for local storage. */
  storagePath: string;
  /** Whether automatic backups are enabled. */
  autoBackupEnabled: boolean;
  /** Interval (days) between automatic backups. */
  autoBackupIntervalDays: number;
}
