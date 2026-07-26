/** Data transfer object for a note record. */
export interface NoteDTO {
  id: string;
  vault_id: string;
  title: string;
  encrypted_content: string;
  is_encrypted: number;
  color: string | null;
  is_pinned: number;
  created_at: number;
  updated_at: number;
}
