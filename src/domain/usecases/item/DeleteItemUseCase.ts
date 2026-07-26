import { IItemRepository } from '@domain/repositories/IItemRepository';
import { Result } from '@core/errors';

export class DeleteItemUseCase {
  constructor(private itemRepository: IItemRepository) {}

  async execute(id: string, permanent: boolean = false): Promise<Result<void>> {
    if (permanent) {
      return this.itemRepository.delete(id);
    }
    return this.itemRepository.softDelete(id);
  }
}
