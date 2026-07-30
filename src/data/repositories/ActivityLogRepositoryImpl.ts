import { IActivityLogRepository, ActivityLogQueryOptions } from '@domain/repositories/IActivityLogRepository';
import { ActivityLogEntry } from '@domain/entities/ActivityLog';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { ActivityLogDTO } from '@data/dto/ActivityLogDTO';
import { ActivityLogMapper } from '@data/mappers/ActivityLogMapper';
import { DatabaseService } from '@data/database/DatabaseService';
import { ActivityAction } from '@core/constants';
import { generateId } from '@core/utils';

/** Implementation of IActivityLogRepository backed by SQLite via DatabaseService. */
export class ActivityLogRepositoryImpl implements IActivityLogRepository {
  private mapper = new ActivityLogMapper();

  constructor(private db: DatabaseService) {}

  /** Records a new activity log entry. */
  async log(
    action: ActivityAction,
    targetType?: string,
    targetId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Result<void>> {
    try {
      const entry: ActivityLogDTO = {
        id: generateId(),
        action,
        target_type: targetType ?? null,
        target_id: targetId ?? null,
        metadata_json: metadata ? JSON.stringify(metadata) : null,
        vault_id: undefined,
        created_at: this.db.now(),
      };
      await this.db.executeSql(
        'INSERT INTO activity_log (id, vault_id, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [entry.id, entry.vault_id, entry.action, entry.target_type, entry.target_id, entry.metadata_json, entry.created_at],
      );
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to log activity', (error as Error).message));
    }
  }

  /** Returns all activity log entries with optional filtering by action and pagination. */
  async findAll(options?: ActivityLogQueryOptions): Promise<Result<ActivityLogEntry[]>> {
    try {
      let sql = 'SELECT * FROM activity_log';
      const params: unknown[] = [];

      if (options?.actions && options.actions.length > 0) {
        sql += ` WHERE action IN (${options.actions.map(() => '?').join(',')})`;
        params.push(...options.actions);
      }

      sql += ' ORDER BY created_at DESC';

      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }
      if (options?.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }

      const rows = await this.db.query<ActivityLogDTO>(sql, params);
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to fetch activity log', (error as Error).message));
    }
  }

  /** Finds all activity log entries for a specific action. */
  async findByAction(action: ActivityAction): Promise<Result<ActivityLogEntry[]>> {
    try {
      const rows = await this.db.query<ActivityLogDTO>(
        'SELECT * FROM activity_log WHERE action = ? ORDER BY created_at DESC',
        [action],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to find activity by action', (error as Error).message));
    }
  }

  /** Returns the most recent activity log entries up to the given limit. */
  async getRecent(limit: number): Promise<Result<ActivityLogEntry[]>> {
    try {
      const rows = await this.db.query<ActivityLogDTO>(
        'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?',
        [limit],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to get recent activity', (error as Error).message));
    }
  }

  /** Deletes all activity log entries. */
  async clear(): Promise<Result<void>> {
    try {
      await this.db.executeSql('DELETE FROM activity_log');
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to clear activity log', (error as Error).message));
    }
  }

  /** Returns the total number of activity log entries. */
  async count(): Promise<Result<number>> {
    try {
      const row = await this.db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM activity_log');
      return success(row?.count ?? 0);
    } catch (error) {
      return failure(new DatabaseError('Failed to count activity log', (error as Error).message));
    }
  }
}
