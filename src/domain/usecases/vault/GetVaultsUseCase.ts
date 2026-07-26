import { Vault } from '@domain/entities/Vault';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Result } from '@core/errors';

export class GetVaultsUseCase {
  constructor(private vaultRepository: IVaultRepository) {}

  async execute(): Promise<Result<Vault[]>> {
    return this.vaultRepository.findAll();
  }
}
