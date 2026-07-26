import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Result, failure, AuthenticationError } from '@core/errors';
import { hashPin } from '@core/utils';

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
    const pinHash = await hashPin(pin, vault.pinSalt);

    if (pinHash !== vault.encryptedPinHash) {
      return failure(new AuthenticationError('Invalid PIN'));
    }

    return this.vaultRepository.unlock(id);
  }
}
