import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { Result, failure, AuthenticationError } from '@core/errors';
import { hashPin } from '@core/utils';

export class BiometricUnlockUseCase {
  private static readonly BIOMETRIC_PREFIX = 'biometric_pin_';

  constructor(
    private vaultRepository: IVaultRepository,
    private secureStorage: SecureStorageSource,
  ) {}

  async execute(vaultId: string): Promise<Result<void>> {
    const encryptedPin = await this.secureStorage.get(
      `${BiometricUnlockUseCase.BIOMETRIC_PREFIX}${vaultId}`,
    );
    if (!encryptedPin) {
      return failure(new AuthenticationError('No biometric token stored'));
    }

    const vaultResult = await this.vaultRepository.findById(vaultId);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }

    const vault = vaultResult.data;
    const pinHash = await hashPin(encryptedPin, vault.pinSalt);
    if (pinHash !== vault.encryptedPinHash) {
      return failure(new AuthenticationError('Biometric data corrupted'));
    }

    return this.vaultRepository.unlock(vaultId);
  }

  async storeBiometricPin(vaultId: string, pin: string): Promise<void> {
    await this.secureStorage.set(
      `${BiometricUnlockUseCase.BIOMETRIC_PREFIX}${vaultId}`,
      pin,
    );
  }

  async hasBiometricPin(vaultId: string): Promise<boolean> {
    return this.secureStorage.contains(
      `${BiometricUnlockUseCase.BIOMETRIC_PREFIX}${vaultId}`,
    );
  }

  async removeBiometricPin(vaultId: string): Promise<void> {
    await this.secureStorage.delete(
      `${BiometricUnlockUseCase.BIOMETRIC_PREFIX}${vaultId}`,
    );
  }
}
