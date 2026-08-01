import { VaultType } from '@core/constants';

/** Represents a vault entity. */
export interface Vault {
  /** Unique identifier for the vault. */
  id: string;
  /** Display name of the vault. */
  name: string;
  /** Type of the vault (e.g. personal, work). */
  type: VaultType;
  /** Icon identifier for the vault. */
  icon: string;
  /** Color associated with the vault. */
  color: string;
  /** Timestamp (ms) when the vault was created. */
  createdAt: number;
  /** Timestamp (ms) when the vault was last updated. */
  updatedAt: number;
  /** Timestamp (ms) when the vault was last accessed, or null if never. */
  lastAccessedAt: number | null;
  /** Whether the vault is currently locked. */
  isLocked: boolean;
  /** Encrypted hash of the vault PIN. */
  encryptedPinHash: string;
  /** Salt used for PIN hashing. */
  pinSalt: string;
  /** Number of consecutive failed login attempts. */
  failedAttempts: number;
  /** Timestamp (ms) until the vault is locked, or null if not locked. */
  lockedUntil: number | null;
  /** Number of items stored in the vault. */
  itemCount: number;
  /** Total size (bytes) of vault contents. */
  totalSize: number;
}
