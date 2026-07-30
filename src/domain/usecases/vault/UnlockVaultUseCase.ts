import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Result, failure, AuthenticationError } from '@core/errors';
import { hashPin } from '@core/utils';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000;

export class UnlockVaultUseCase {
  constructor(
    private vaultRepository: IVaultRepository,
  ) {}

  async execute(id: string, pin: string): Promise<Result<void>> {
    const vaultResult = await this.vaultRepository.findById(id);
    if (!vaultResult.success || !vaultResult.data) {
      return failure(new AuthenticationError('Vault not found'));
    }

    const vault = vaultResult.data;

    if (vault.failedAttempts >= MAX_ATTEMPTS && vault.lockedUntil) {
      const now = Date.now();
      if (now < vault.lockedUntil) {
        const remaining = Math.ceil((vault.lockedUntil - now) / 1000);
        return failure(new AuthenticationError(
          `Vault is locked. Try again in ${remaining} seconds.`,
        ));
      }
      await this.vaultRepository.updateFields(id, {
        failedAttempts: 0,
        lockedUntil: null,
      });
    }

    const pinHash = await hashPin(pin, vault.pinSalt);

    if (pinHash !== vault.encryptedPinHash) {
      const newFailed = vault.failedAttempts + 1;
      let lockedUntil: number | null = null;
      if (newFailed >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_DURATION;
      }
      await this.vaultRepository.updateFields(id, {
        failedAttempts: newFailed,
        lockedUntil,
      });

      const remaining = MAX_ATTEMPTS - newFailed;
      const msg = remaining > 0
        ? `Incorrect PIN. ${remaining} attempts remaining.`
        : 'Vault is locked. Try again in 5 minutes.';
      return failure(new AuthenticationError(msg));
    }

    if (vault.failedAttempts > 0) {
      await this.vaultRepository.updateFields(id, {
        failedAttempts: 0,
        lockedUntil: null,
      });
    }
    return this.vaultRepository.unlock(id);
  }
}
