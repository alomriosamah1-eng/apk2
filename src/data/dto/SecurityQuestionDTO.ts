/** Data transfer object for a security question record. */
export interface SecurityQuestionDTO {
  id: string;
  vault_id: string;
  question: string;
  answer_hash: string;
  answer_salt: string;
  position: number;
  created_at: number;
  updated_at: number;
}