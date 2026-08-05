import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { ISecurityQuestionRepository } from '@domain/repositories/ISecurityQuestionRepository';
import { Result, success, failure, AuthenticationError, ValidationError, DomainError } from '@core/errors';
import { generateSalt, hashPin } from '@core/utils';
import { validatePin } from '@core/validators';
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';
import { VerifySecurityAnswersUseCase } from './VerifySecurityAnswersUseCase';

/**
 * Resets a vault's PIN after the user correctly answers the security questions.
 * Re-verifies the answers in the same operation, re-hashes the new PIN with a
 * fresh salt, resets any failed-attempt lockout, refreshes the biometric token,
 * and unlocks the vault.
 */
export class ResetPinWithSecurityQuestionsUseCase {
  constructor(
    private vaultRepository: IVaultRepository,
    private securityQuestionRepository: ISecurityQuestionRepository,
    private biometricUnlockUseCase?: BiometricUnlockUseCase,
  ) {}

  async execute(vaultId: string, answers: string[], newPin: string): Promise<Result<void>> {
    const vaultResult = await this.vaultRepository.findById(vaultId);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }
    const vault = vaultResult.data;

    const pinValidation = validatePin(newPin);
    if (!pinValidation.valid) {
      return failure(new ValidationError('pin', pinValidation.error ?? 'Invalid PIN'));
    }

    const verify = new VerifySecurityAnswersUseCase(this.securityQuestionRepository);
    const verifyResult = await verify.execute(vaultId, answers);
    if (!verifyResult.success) {
      return failure(verifyResult.error);
    }
    if (!verifyResult.data.verified) {
      return failure(new AuthenticationError('Security answers are incorrect'));
    }

    const pinSalt = await generateSalt();
    const encryptedPinHash = await hashPin(newPin, pinSalt);

    const updated = await this.vaultRepository.update({
      ...vault,
      encryptedPinHash,
      pinSalt,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: Date.now(),
    });
    if (!updated.success) {
      return failure(new DomainError(
        'Could not reset PIN',
        'PIN_RESET_FAILED',
        { cause: (updated.error as Error).message },
      ));
    }

    await this.vaultRepository.unlock(vaultId);

    if (this.biometricUnlockUseCase) {
      await this.biometricUnlockUseCase.storeBiometricPin(vaultId, newPin);
    }

    return success(undefined);
  }
}