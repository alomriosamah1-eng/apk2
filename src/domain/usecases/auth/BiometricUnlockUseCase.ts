import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { ISecureStorage } from '@domain/repositories/ISecureStorage';
import { Result, failure, AuthenticationError } from '@core/errors';
import { verifyPin } from '@core/utils';
import { encryptData, decryptData, generateEncryptionKey } from '@core/utils/crypto';

const MAX_ATTEMPTS = 5;

/**
 * Biometric unlock backed by an encrypted token (Recovery/05 §5.3, R4).
 * The PIN is never stored in plaintext: it is AES-256-GCM encrypted under a
 * device-level key held in secure storage, and decrypted only in-memory at
 * unlock time.
 */
export class BiometricUnlockUseCase {
  private static readonly TOKEN_PREFIX = 'biometric_token_';
  private static readonly DEVICE_KEY = 'biometric_device_key';

  constructor(
    private vaultRepository: IVaultRepository,
    private secureStorage: ISecureStorage,
  ) {}

  private async getDeviceKey(): Promise<string> {
    const existing = await this.secureStorage.get(BiometricUnlockUseCase.DEVICE_KEY);
    if (existing) return existing;
    const key = await generateEncryptionKey();
    await this.secureStorage.set(BiometricUnlockUseCase.DEVICE_KEY, key);
    return key;
  }

  async execute(vaultId: string): Promise<Result<void>> {
    const token = await this.secureStorage.get(
      `${BiometricUnlockUseCase.TOKEN_PREFIX}${vaultId}`,
    );
    if (!token) {
      return failure(new AuthenticationError('No biometric token stored'));
    }

    const vaultResult = await this.vaultRepository.findById(vaultId);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }
    const vault = vaultResult.data;

    if (vault.failedAttempts >= MAX_ATTEMPTS && vault.lockedUntil) {
      if (Date.now() < vault.lockedUntil) {
        return failure(new AuthenticationError('Vault is locked. Try again in 5 minutes.'));
      }
      await this.vaultRepository.updateFields(vaultId, {
        failedAttempts: 0,
        lockedUntil: null,
      });
    }

    let pin: string;
    try {
      const deviceKey = await this.getDeviceKey();
      pin = await decryptData(deviceKey, token);
    } catch {
      return failure(new AuthenticationError('Biometric token corrupted'));
    }

    const verification = await verifyPin(pin, vault.pinSalt, vault.encryptedPinHash);
    if (!verification.verified) {
      return failure(new AuthenticationError('Biometric data corrupted'));
    }

    return this.vaultRepository.unlock(vaultId);
  }

  /** Stores a biometric token by encrypting the PIN under the device key. */
  async storeBiometricPin(vaultId: string, pin: string): Promise<void> {
    const deviceKey = await this.getDeviceKey();
    const token = await encryptData(deviceKey, pin);
    await this.secureStorage.set(
      `${BiometricUnlockUseCase.TOKEN_PREFIX}${vaultId}`,
      token,
    );
  }

  async hasBiometricPin(vaultId: string): Promise<boolean> {
    return this.secureStorage.contains(
      `${BiometricUnlockUseCase.TOKEN_PREFIX}${vaultId}`,
    );
  }

  async removeBiometricPin(vaultId: string): Promise<void> {
    await this.secureStorage.delete(
      `${BiometricUnlockUseCase.TOKEN_PREFIX}${vaultId}`,
    );
  }
}
