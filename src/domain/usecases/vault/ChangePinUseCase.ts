import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Result, failure, success, AuthenticationError, DomainError, ValidationError } from '@core/errors';
import { verifyPin, hashPin, generateSalt } from '@core/utils';
import { validatePin } from '@core/validators';
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';

/**
 * Changes a vault's PIN. Verifies the current PIN first, then re-hashes the new
 * PIN with a fresh salt and persists it (plus any biometric-authenticator pin).
 */
export class ChangePinUseCase {
  constructor(
    private vaultRepository: IVaultRepository,
    private biometricUnlockUseCase?: BiometricUnlockUseCase,
  ) {}

  async execute(id: string, currentPin: string, newPin: string): Promise<Result<void>> {
    const vaultResult = await this.vaultRepository.findById(id);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }
    const vault = vaultResult.data;

    const pinValidation = validatePin(newPin);
    if (!pinValidation.valid) {
      return failure(new ValidationError('pin', pinValidation.error ?? 'Invalid PIN'));
    }

    const verification = await verifyPin(currentPin, vault.pinSalt, vault.encryptedPinHash);
    if (!verification.verified) {
      return failure(new AuthenticationError('Current PIN is incorrect'));
    }

    const pinSalt = await generateSalt();
    const encryptedPinHash = await hashPin(newPin, pinSalt);

    const updated = await this.vaultRepository.update({
      ...vault,
      encryptedPinHash,
      pinSalt,
      updatedAt: Date.now(),
    });
    if (!updated.success) {
      return failure(new DomainError(
        'Could not change PIN',
        'PIN_CHANGE_FAILED',
        { cause: (updated.error as Error).message },
      ));
    }

    if (this.biometricUnlockUseCase) {
      await this.biometricUnlockUseCase.storeBiometricPin(vault.id, newPin);
    }

    return success(undefined);
  }
}