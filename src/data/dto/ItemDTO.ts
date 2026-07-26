/** Data transfer object for an item record. */
export interface ItemDTO {
  id: string;
  vault_id: string;
  parent_id: string | null;
  name: string;
  type: string;
  mime_type: string | null;
  size: number;
  encrypted_path: string | null;
  encrypted_data: string | null;
  thumbnail_path: string | null;
  metadata_json: string | null;
  is_favorite: number;
  is_deleted: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}
