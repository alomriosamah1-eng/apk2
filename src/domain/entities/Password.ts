/** Represents a stored password entry. */
export interface PasswordEntry {
  /** Unique identifier for the password entry. */
  id: string;
  /** ID of the vault this password belongs to. */
  vaultId: string;
  /** Name of the service or application. */
  serviceName: string;
  /** URL of the service, or null if not applicable. */
  serviceUrl: string | null;
  /** Username associated with the account, or null. */
  username: string | null;
  /** Encrypted password string. */
  encryptedPassword: string;
  /** Category or group for the password entry, or null. */
  category: string | null;
  /** Optional notes attached to the entry, or null. */
  notes: string | null;
  /** Strength score (0–100) of the password. */
  strengthScore: number;
  /** Timestamp (ms) when the entry was created. */
  createdAt: number;
  /** Timestamp (ms) when the entry was last updated. */
  updatedAt: number;
  /** Timestamp (ms) when the entry was last used, or null if never. */
  lastUsedAt: number | null;
}
