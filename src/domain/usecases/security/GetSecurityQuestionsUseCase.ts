import { ISecurityQuestionRepository } from '@domain/repositories/ISecurityQuestionRepository';
import { SecurityQuestion } from '@domain/entities/SecurityQuestion';
import { Result, success, failure } from '@core/errors';

/**
 * Returns a vault's security questions. Used to render the recovery screen;
 * exposes only the question text/order (never the answer hashes).
 */
export class GetSecurityQuestionsUseCase {
  constructor(private securityQuestionRepository: ISecurityQuestionRepository) {}

  async execute(vaultId: string): Promise<Result<SecurityQuestion[]>> {
    const result = await this.securityQuestionRepository.findByVaultId(vaultId);
    if (!result.success) {
      return failure(result.error);
    }
    return success(result.data);
  }
}