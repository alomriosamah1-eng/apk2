import { ActivityAction } from '@core/constants';

/** Represents a single activity log entry. */
export interface ActivityLogEntry {
  /** Unique identifier for the log entry. */
  id: string;
  /** ID of the vault this entry belongs to, if applicable. */
  vaultId?: string;
  /** The action that was performed. */
  action: ActivityAction;
  /** Type of the target entity, or null. */
  targetType: string | null;
  /** ID of the target entity, or null. */
  targetId: string | null;
  /** Additional metadata related to the action. */
  metadata: Record<string, unknown> | null;
  /** Timestamp (ms) when the action occurred. */
  createdAt: number;
}
