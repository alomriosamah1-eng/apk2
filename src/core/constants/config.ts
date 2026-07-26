/** Application-wide configuration constants. */
export const APP_CONFIG = {
  name: 'Khaznati',
  version: '1.0.0',
  buildNumber: 1,
  packageName: 'com.khaznati.vault',

  /** Database configuration. */
  database: {
    name: 'khaznati.db',
    version: 1,
    cipherPageSize: 4096,
    kdfIterations: 64000,
  },

  /** Security and encryption configuration. */
  security: {
    pbkdf2Iterations: 600000,
    saltLength: 32,
    keyLength: 32,
    ivLength: 12,
    tagLength: 16,
    algorithm: 'aes-256-gcm' as const,
    maxLoginAttempts: 5,
    lockoutDurationMs: 5 * 60 * 1000,
    autoLockSeconds: 60,
    sessionTimeoutMs: 15 * 60 * 1000,
    clipboardClearMs: 10000,
  },

  /** Storage limits and chunk settings. */
  storage: {
    thumbnailsMaxWidth: 256,
    thumbnailCacheDays: 30,
    maxFileSize: 500 * 1024 * 1024,
    chunkSize: 1024 * 1024,
  },

  /** Backup file format configuration. */
  backup: {
    fileExtension: '.kzb',
    magicHeader: 'KHAZNAti',
    currentVersion: 1,
  },
} as const;
