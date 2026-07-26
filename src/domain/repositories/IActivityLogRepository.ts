import { ActivityLogEntry } from '@domain/entities/ActivityLog';
import { ActivityAction } from '@core/constants';
import { Result } from '@core/errors';

/** Repository interface for activity log persistence operations. */
export interface IActivityLogRepository {
  /** Records a new activity log entry. */
  log(action: ActivityAction, targetType?: string, targetId?: string, metadata?: Record<string, unknown>): Promise<Result<void>>;
  /** Retrieves all activity log entries with optional query options. */
  findAll(options?: ActivityLogQueryOptions): Promise<Result<ActivityLogEntry[]>>;
  /** Finds activity log entries by action type. */
  findByAction(action: ActivityAction): Promise<Result<ActivityLogEntry[]>>;
  /** Retrieves the most recent activity log entries. */
  getRecent(limit: number): Promise<Result<ActivityLogEntry[]>>;
  /** Clears all activity log entries. */
  clear(): Promise<Result<void>>;
  /** Returns the total number of activity log entries. */
  count(): Promise<Result<number>>;
}

/** Query options for filtering activity log entries. */
export interface ActivityLogQueryOptions {
  limit?: number;
  offset?: number;
  actions?: ActivityAction[];
}
