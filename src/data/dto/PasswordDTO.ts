/** Data transfer object for a password record. */
export interface PasswordDTO {
  id: string;
  vault_id: string;
  service_name: string;
  service_url: string | null;
  username: string | null;
  encrypted_password: string;
  category: string | null;
  notes: string | null;
  strength_score: number;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}
