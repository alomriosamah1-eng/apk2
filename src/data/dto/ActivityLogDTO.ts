/** Data transfer object for an activity log record. */
export interface ActivityLogDTO {
  id: string;
  vault_id?: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_json: string | null;
  created_at: number;
}
