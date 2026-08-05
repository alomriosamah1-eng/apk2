import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { ISecurityQuestionRepository } from '@domain/repositories/ISecurityQuestionRepository';
import { SecurityQuestion } from '@domain/entities/SecurityQuestion';
import { Result, success, failure, AuthenticationError, ValidationError, DomainError } from '@core/errors';
import { verifyPin, generateId } from '@core/utils';
import {
  MIN_SECURITY_QUESTIONS,
  MAX_SECURITY_QUESTIONS,
  MIN_SECURITY_ANSWER_LENGTH,
  MAX_SECURITY_ANSWER_LENGTH,
  MAX_SECURITY_QUESTION_LENGTH,
} from '@core/constants/securityQuestions';
import { hashAnswer } from './securityAnswers';

/** A single security question with its (plaintext) answer, as supplied by the user. */
export interface SecurityQuestionInput {
  question: string;
  answer: string;
}

/**
 * Sets or replaces a vault's security questions. Authorized by verifying the
 * current PIN so questions cannot be changed without knowing it.
 */
export class SetupSecurityQuestionsUseCase {
  constructor(
    private vaultRepository: IVaultRepository,
    private securityQuestionRepository: ISecurityQuestionRepository,
  ) {}

  async execute(
    vaultId: string,
    currentPin: string,
    inputs: SecurityQuestionInput[],
  ): Promise<Result<void>> {
    const vaultResult = await this.vaultRepository.findById(vaultId);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }
    const vault = vaultResult.data;

    const verification = await verifyPin(currentPin, vault.pinSalt, vault.encryptedPinHash);
    if (!verification.verified) {
      return failure(new AuthenticationError('Current PIN is incorrect'));
    }

    if (inputs.length < MIN_SECURITY_QUESTIONS || inputs.length > MAX_SECURITY_QUESTIONS) {
      return failure(new ValidationError(
        'questions',
        `Must provide between ${MIN_SECURITY_QUESTIONS} and ${MAX_SECURITY_QUESTIONS} questions`,
      ));
    }

    const timestamp = Date.now();
    const questions: SecurityQuestion[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!;
      const question = input.question.trim();
      if (!question) {
        return failure(new ValidationError(`question_${i}`, 'Question is required'));
      }
      if (question.length > MAX_SECURITY_QUESTION_LENGTH) {
        return failure(new ValidationError(
          `question_${i}`,
          `Question must be at most ${MAX_SECURITY_QUESTION_LENGTH} characters`,
        ));
      }
      if (input.answer.length < MIN_SECURITY_ANSWER_LENGTH || input.answer.length > MAX_SECURITY_ANSWER_LENGTH) {
        return failure(new ValidationError(
          `answer_${i}`,
          `Answer must be between ${MIN_SECURITY_ANSWER_LENGTH} and ${MAX_SECURITY_ANSWER_LENGTH} characters`,
        ));
      }
      const { salt, hash } = await hashAnswer(input.answer);
      questions.push({
        id: generateId(),
        vaultId,
        question,
        answerHash: hash,
        answerSalt: salt,
        position: i,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const saved = await this.securityQuestionRepository.replaceForVault(vaultId, questions);
    if (!saved.success) {
      return failure(new DomainError(
        'Could not save security questions',
        'SECURITY_QUESTIONS_SAVE_FAILED',
        { cause: (saved.error as Error).message },
      ));
    }

    return success(undefined);
  }
}