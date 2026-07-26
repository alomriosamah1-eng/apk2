/** Represents a note entity. */
export interface Note {
  /** Unique identifier for the note. */
  id: string;
  /** ID of the vault this note belongs to. */
  vaultId: string;
  /** Title of the note. */
  title: string;
  /** Encrypted content of the note. */
  encryptedContent: string;
  /** Whether the note content is encrypted. */
  isEncrypted: boolean;
  /** Accent color for the note, or null if none. */
  color: string | null;
  /** Whether the note is pinned to the top. */
  isPinned: boolean;
  /** Timestamp (ms) when the note was created. */
  createdAt: number;
  /** Timestamp (ms) when the note was last updated. */
  updatedAt: number;
}
