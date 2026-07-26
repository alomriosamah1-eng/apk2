import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Result } from '@core/errors';

export class LockVaultUseCase {
  constructor(private vaultRepository: IVaultRepository) {}

  async execute(id: string): Promise<Result<void>> {
    return this.vaultRepository.lock(id);
  }
}
