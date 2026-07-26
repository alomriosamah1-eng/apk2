import { Item } from '@domain/entities/Item';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { Result } from '@core/errors';

export class SearchItemsUseCase {
  constructor(private itemRepository: IItemRepository) {}

  async execute(vaultId: string, query: string): Promise<Result<Item[]>> {
    if (!query.trim()) {
      return this.itemRepository.findByVaultId(vaultId);
    }
    return this.itemRepository.search(vaultId, query.trim());
  }
}
