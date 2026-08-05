import { SecurityQuestion } from '@domain/entities/SecurityQuestion';
import { Result } from '@core/errors';

/** Repository interface for security-question persistence operations. */
export interface ISecurityQuestionRepository {
  /** Returns the security questions for a vault, ordered by position. */
  findByVaultId(vaultId: string): Promise<Result<SecurityQuestion[]>>;
  /** Replaces all security questions for a vault with the given ones (transactional). */
  replaceForVault(vaultId: string, questions: SecurityQuestion[]): Promise<Result<void>>;
}