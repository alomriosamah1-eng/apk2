/** Represents a single security question stored for a vault (answer is hashed). */
export interface SecurityQuestion {
  /** Unique identifier for the security question. */
  id: string;
  /** Vault the question belongs to. */
  vaultId: string;
  /** Question text shown to the user during recovery. */
  question: string;
  /** PBKDF2 hash of the normalized answer. */
  answerHash: string;
  /** Salt used to hash the answer. */
  answerSalt: string;
  /** Display order within the vault (0-based). */
  position: number;
  /** Timestamp (ms) when the question was created. */
  createdAt: number;
  /** Timestamp (ms) when the question was last updated. */
  updatedAt: number;
}
