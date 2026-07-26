import { ItemType } from '@core/constants';

/** Represents an item stored within a vault. */
export interface Item {
  /** Unique identifier for the item. */
  id: string;
  /** ID of the vault this item belongs to. */
  vaultId: string;
  /** ID of the parent item (for nested items), or null if root-level. */
  parentId: string | null;
  /** Display name of the item. */
  name: string;
  /** Type of the item (e.g. file, folder). */
  type: ItemType;
  /** MIME type of the item content, or null for folders. */
  mimeType: string | null;
  /** Size of the item in bytes. */
  size: number;
  /** Encrypted storage path, or null for non-file items. */
  encryptedPath: string | null;
  /** Encrypted content data, or null if not stored inline. */
  encryptedData: string | null;
  /** Path to the thumbnail image, or null if none. */
  thumbnailPath: string | null;
  /** Arbitrary metadata associated with the item. */
  metadata: Record<string, unknown> | null;
  /** Whether the item is marked as a favorite. */
  isFavorite: boolean;
  /** Whether the item is soft-deleted. */
  isDeleted: boolean;
  /** Timestamp (ms) when the item was created. */
  createdAt: number;
  /** Timestamp (ms) when the item was last updated. */
  updatedAt: number;
  /** Timestamp (ms) when the item was soft-deleted, or null if not deleted. */
  deletedAt: number | null;
}
