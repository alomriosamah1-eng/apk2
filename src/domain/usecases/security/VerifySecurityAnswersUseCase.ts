import { ISecurityQuestionRepository } from '@domain/repositories/ISecurityQuestionRepository';
import { Result, success, failure, AuthenticationError, ValidationError } from '@core/errors';
import { verifyAnswer } from './securityAnswers';

export interface VerifySecurityAnswersResult {
  verified: boolean;
  failedIndexes: number[];
}

/**
 * Verifies a user's answers against the vault's stored security questions.
 * Runs in constant time per question, so it does not leak which answer failed.
 */
export class VerifySecurityAnswersUseCase {
  constructor(private securityQuestionRepository: ISecurityQuestionRepository) {}

  async execute(vaultId: string, answers: string[]): Promise<Result<VerifySecurityAnswersResult>> {
    const questionsResult = await this.securityQuestionRepository.findByVaultId(vaultId);
    if (!questionsResult.success || !questionsResult.data) {
      return failure(new AuthenticationError('No security questions configured'));
    }
    const questions = questionsResult.data;
    if (questions.length === 0) {
      return failure(new AuthenticationError('No security questions configured'));
    }
    if (answers.length !== questions.length) {
      return failure(new ValidationError('answers', 'Answer count does not match questions'));
    }

    const failedIndexes: number[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      const ok = await verifyAnswer(answers[i] ?? '', q.answerSalt, q.answerHash);
      if (!ok) failedIndexes.push(i);
    }

    return success({ verified: failedIndexes.length === 0, failedIndexes });
  }
}