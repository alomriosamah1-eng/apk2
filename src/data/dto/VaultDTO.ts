/** Data transfer object for a vault record. */
export interface VaultDTO {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  created_at: number;
  updated_at: number;
  last_accessed_at: number | null;
  is_locked: number;
  encrypted_pin_hash: string;
  pin_salt: string;
  item_count: number;
  total_size: number;
  backup_version: number;
}
