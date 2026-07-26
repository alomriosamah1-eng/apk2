import { Item } from '@domain/entities/Item';
import { ItemType, SortBy, SortOrder } from '@core/constants';
import { Result } from '@core/errors';

/** Repository interface for item persistence operations. */
export interface IItemRepository {
  /** Creates a new item. */
  create(item: Item): Promise<Result<Item>>;
  /** Finds an item by its ID. */
  findById(id: string): Promise<Result<Item | null>>;
  /** Finds all items within a vault, with optional query options. */
  findByVaultId(vaultId: string, options?: ItemQueryOptions): Promise<Result<Item[]>>;
  /** Finds items by their parent folder within a vault. */
  findByParentId(vaultId: string, parentId: string | null, options?: ItemQueryOptions): Promise<Result<Item[]>>;
  /** Updates an existing item. */
  update(item: Item): Promise<Result<Item>>;
  /** Permanently deletes an item by its ID. */
  delete(id: string): Promise<Result<void>>;
  /** Soft-deletes an item (marks as deleted). */
  softDelete(id: string): Promise<Result<void>>;
  /** Restores a soft-deleted item. */
  restore(id: string): Promise<Result<void>>;
  /** Moves an item to a new parent folder. */
  move(id: string, newParentId: string | null): Promise<Result<void>>;
  /** Toggles the favorite status of an item. */
  toggleFavorite(id: string): Promise<Result<void>>;
  /** Searches items within a vault matching a query string. */
  search(vaultId: string, query: string): Promise<Result<Item[]>>;
  /** Returns the number of items in a vault. */
  countByVaultId(vaultId: string): Promise<Result<number>>;
  /** Returns the total storage size of all items in a vault. */
  getTotalSize(vaultId: string): Promise<Result<number>>;
  /** Retrieves the most recently accessed items. */
  getRecentItems(limit: number): Promise<Result<Item[]>>;
}

/** Query options for filtering and sorting items. */
export interface ItemQueryOptions {
  type?: ItemType;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}
