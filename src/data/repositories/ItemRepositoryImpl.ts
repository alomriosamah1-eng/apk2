import { IItemRepository, ItemQueryOptions } from '@domain/repositories/IItemRepository';
import { Item } from '@domain/entities/Item';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { ItemDTO } from '@data/dto/ItemDTO';
import { ItemMapper } from '@data/mappers/ItemMapper';
import { DatabaseService } from '@data/database/DatabaseService';

/** Implementation of IItemRepository backed by SQLite via DatabaseService. */
export class ItemRepositoryImpl implements IItemRepository {
  private mapper = new ItemMapper();
  private readonly ITEM_COLUMNS = 'id, vault_id, parent_id, name, type, mime_type, size, encrypted_path, encrypted_data, thumbnail_path, metadata_json, is_favorite, is_deleted, created_at, updated_at, deleted_at';

  constructor(private db: DatabaseService) {}

  /** Inserts a new item record and updates the parent vault counts. */
  async create(item: Item): Promise<Result<Item>> {
    try {
      const dto = this.mapper.toDTO(item);
      await this.db.executeSql(
        `INSERT INTO items (id, vault_id, parent_id, name, type, mime_type, size, 
         encrypted_path, encrypted_data, thumbnail_path, metadata_json, is_favorite, 
         is_deleted, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.id, dto.vault_id, dto.parent_id, dto.name, dto.type, dto.mime_type,
         dto.size, dto.encrypted_path, dto.encrypted_data, dto.thumbnail_path,
         dto.metadata_json, dto.is_favorite, dto.is_deleted, dto.created_at,
         dto.updated_at, dto.deleted_at],
      );
      await this.updateVaultCounts(item.vaultId);
      return success(item);
    } catch (error) {
      return failure(new DatabaseError('Failed to create item', (error as Error).message));
    }
  }

  /** Deletes multiple items in one transaction and updates vault counts once. */
  async deleteMany(ids: string[], vaultId: string): Promise<Result<void>> {
    if (ids.length === 0) return success(undefined);
    try {
      await this.db.transaction(async () => {
        const placeholders = ids.map(() => '?').join(',');
        await this.db.executeSql(`DELETE FROM items WHERE id IN (${placeholders})`, ids);
        const vaultResult = await this.db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM vaults WHERE id = ?', [vaultId]);
        if (vaultResult && vaultResult.count > 0) {
          await this.updateVaultCounts(vaultId);
        }
      });
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete many items', (error as Error).message));
    }
  }

  /**
   * Inserts many items within a single database transaction and recomputes the
   * vault counts exactly once afterwards. Bulk import should use this instead of
   * calling {@link create} per file (which triggers a count query per insert).
   */
  async createMany(items: Item[]): Promise<Result<void>> {
    if (items.length === 0) return success(undefined);
    const vaultId = items[0]?.vaultId;
    if (!vaultId) return failure(new DatabaseError('createMany requires a vaultId', 'Missing vaultId'));
    try {
      await this.db.transaction(async () => {
        for (const item of items) {
          const dto = this.mapper.toDTO(item);
          await this.db.executeSql(
            `INSERT INTO items (id, vault_id, parent_id, name, type, mime_type, size, 
             encrypted_path, encrypted_data, thumbnail_path, metadata_json, is_favorite, 
             is_deleted, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dto.id, dto.vault_id, dto.parent_id, dto.name, dto.type, dto.mime_type,
             dto.size, dto.encrypted_path, dto.encrypted_data, dto.thumbnail_path,
             dto.metadata_json, dto.is_favorite, dto.is_deleted, dto.created_at,
             dto.updated_at, dto.deleted_at],
          );
        }
      });
      await this.updateVaultCounts(vaultId);
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to create items in bulk', (error as Error).message));
    }
  }

  /** Finds an item by its ID, or null if not found. */
  async findById(id: string): Promise<Result<Item | null>> {
    try {
      const row = await this.db.queryOne<ItemDTO>(`SELECT ${this.ITEM_COLUMNS} FROM items WHERE id = ?`, [id]);
      return success(row ? this.mapper.toEntity(row) : null);
    } catch (error) {
      return failure(new DatabaseError('Failed to find item', (error as Error).message));
    }
  }

  /** Finds all non-deleted items in a vault with optional filtering, sorting, and pagination. */
  async findByVaultId(vaultId: string, options?: ItemQueryOptions): Promise<Result<Item[]>> {
    try {
      let sql = `SELECT ${this.ITEM_COLUMNS} FROM items WHERE vault_id = ? AND is_deleted = 0`;
      const params: unknown[] = [vaultId];

      if (options?.type) {
        sql += ' AND type = ?';
        params.push(options.type);
      }

      sql += ' ORDER BY ';
      if (options?.sortBy) {
        sql += `${this.mapSortBy(options.sortBy)} ${options?.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      } else {
        sql += 'created_at DESC';
      }

      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }
      if (options?.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }

      const rows = await this.db.query<ItemDTO>(sql, params);
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to query items', (error as Error).message));
    }
  }

  /** Finds items by their parent folder, optionally filtered by type. */
  async findByParentId(vaultId: string, parentId: string | null, options?: ItemQueryOptions): Promise<Result<Item[]>> {
    try {
      let sql = `SELECT ${this.ITEM_COLUMNS} FROM items WHERE vault_id = ? AND parent_id IS ? AND is_deleted = 0`;
      const params: unknown[] = [vaultId, parentId];

      if (options?.type) {
        sql += ' AND type = ?';
        params.push(options.type);
      }

      sql += ' ORDER BY type ASC, name ASC';

      const rows = await this.db.query<ItemDTO>(sql, params);
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to query items by parent', (error as Error).message));
    }
  }

  /** Updates an existing item record. */
  async update(item: Item): Promise<Result<Item>> {
    try {
      const dto = this.mapper.toDTO(item);
      await this.db.executeSql(
        `UPDATE items SET name = ?, type = ?, mime_type = ?, size = ?, encrypted_path = ?,
         encrypted_data = ?, thumbnail_path = ?, metadata_json = ?, is_favorite = ?,
         is_deleted = ?, updated_at = ?, deleted_at = ?
         WHERE id = ?`,
        [dto.name, dto.type, dto.mime_type, dto.size, dto.encrypted_path, dto.encrypted_data,
         dto.thumbnail_path, dto.metadata_json, dto.is_favorite, dto.is_deleted,
         dto.updated_at, dto.deleted_at, dto.id],
      );
      return success(item);
    } catch (error) {
      return failure(new DatabaseError('Failed to update item', (error as Error).message));
    }
  }

  /** Permanently deletes an item and updates vault counts. */
  async delete(id: string): Promise<Result<void>> {
    try {
      await this.db.transaction(async () => {
        const itemResult = await this.findById(id);
        if (!itemResult.success || !itemResult.data) {
          throw new Error('Item not found');
        }
        await this.db.executeSql('DELETE FROM items WHERE id = ?', [id]);
        await this.updateVaultCounts(itemResult.data.vaultId);
      });
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to delete item', (error as Error).message));
    }
  }

  /** Soft-deletes an item by setting the deleted flag and timestamp. */
  async softDelete(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE items SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?',
        [this.db.now(), this.db.now(), id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to soft delete item', (error as Error).message));
    }
  }

  /** Restores a soft-deleted item. */
  async restore(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE items SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?',
        [this.db.now(), id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to restore item', (error as Error).message));
    }
  }

  /** Moves an item to a new parent folder. */
  async move(id: string, newParentId: string | null): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE items SET parent_id = ?, updated_at = ? WHERE id = ?',
        [newParentId, this.db.now(), id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to move item', (error as Error).message));
    }
  }

  /** Toggles the favorite flag on an item. */
  async toggleFavorite(id: string): Promise<Result<void>> {
    try {
      await this.db.executeSql(
        'UPDATE items SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?',
        [id],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to toggle favorite', (error as Error).message));
    }
  }

  /** Searches items by name within a vault. */
  async search(vaultId: string, query: string): Promise<Result<Item[]>> {
    try {
      const rows = await this.db.query<ItemDTO>(
        `SELECT ${this.ITEM_COLUMNS} FROM items WHERE vault_id = ? AND is_deleted = 0 AND name LIKE ? ORDER BY name ASC`,
        [vaultId, `%${query}%`],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to search items', (error as Error).message));
    }
  }

  /** Returns the count of non-deleted items in a vault. */
  async countByVaultId(vaultId: string): Promise<Result<number>> {
    try {
      const row = await this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM items WHERE vault_id = ? AND is_deleted = 0',
        [vaultId],
      );
      return success(row?.count ?? 0);
    } catch (error) {
      return failure(new DatabaseError('Failed to count items', (error as Error).message));
    }
  }

  /** Returns the total size in bytes of all non-deleted items in a vault. */
  async getTotalSize(vaultId: string): Promise<Result<number>> {
    try {
      const row = await this.db.queryOne<{ total: number }>(
        'SELECT COALESCE(SUM(size), 0) as total FROM items WHERE vault_id = ? AND is_deleted = 0',
        [vaultId],
      );
      return success(row?.total ?? 0);
    } catch (error) {
      return failure(new DatabaseError('Failed to get total size', (error as Error).message));
    }
  }

  /** Returns all content hashes stored in metadata for a vault (import dedup). */
  async findContentHashes(vaultId: string): Promise<Result<string[]>> {
    try {
      const rows = await this.db.query<{ metadata_json: string | null }>(
        `SELECT metadata_json FROM items WHERE vault_id = ? AND is_deleted = 0`,
        [vaultId],
      );
      const hashes: string[] = [];
      for (const row of rows) {
        if (!row.metadata_json) continue;
        try {
          const meta = JSON.parse(row.metadata_json) as { content_hash?: string };
          if (typeof meta.content_hash === 'string') hashes.push(meta.content_hash);
        } catch {
          // ignore malformed metadata
        }
      }
      return success(hashes);
    } catch (error) {
      return failure(new DatabaseError('Failed to read content hashes', (error as Error).message));
    }
  }

  /** Returns the most recently created items across all vaults. */
  async getRecentItems(limit: number): Promise<Result<Item[]>> {    try {
      const rows = await this.db.query<ItemDTO>(
        `SELECT ${this.ITEM_COLUMNS} FROM items WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ?`,
        [limit],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to get recent items', (error as Error).message));
    }
  }

  /**
   * Refreshes the cached vault counts (item_count, total_size) with a single
   * SQL statement instead of three round-trips. Called once per mutation batch.
   */
  private async updateVaultCounts(vaultId: string): Promise<void> {
    await this.db.executeSql(
      `UPDATE vaults SET
         item_count = (SELECT COUNT(*) FROM items WHERE vault_id = ? AND is_deleted = 0),
         total_size = (SELECT COALESCE(SUM(size), 0) FROM items WHERE vault_id = ? AND is_deleted = 0)
       WHERE id = ?`,
      [vaultId, vaultId, vaultId],
    );
  }

  private mapSortBy(sortBy: string): string {
    const map: Record<string, string> = {
      name: 'name',
      created_at: 'created_at',
      updated_at: 'updated_at',
      size: 'size',
      type: 'type',
    };
    return map[sortBy] ?? 'created_at';
  }
}
