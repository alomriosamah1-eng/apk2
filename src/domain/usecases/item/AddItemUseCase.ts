import { Item } from '@domain/entities/Item';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { Result, failure, ValidationError } from '@core/errors';
import { generateId, now } from '@core/utils';
import { ItemType } from '@core/constants';

export interface AddItemInput {
  vaultId: string;
  parentId: string | null;
  name: string;
  type: ItemType;
  mimeType: string | null;
  size: number;
  encryptedPath: string | null;
  encryptedData: string | null;
  metadata: Record<string, unknown> | null;
}

export class AddItemUseCase {
  constructor(private itemRepository: IItemRepository) {}

  async execute(input: AddItemInput): Promise<Result<Item>> {
    if (!input.name.trim()) {
      return failure(new ValidationError('name', 'Item name is required'));
    }

    const timestamp = now();
    const item: Item = {
      id: generateId(),
      vaultId: input.vaultId,
      parentId: input.parentId ?? null,
      name: input.name.trim(),
      type: input.type,
      mimeType: input.mimeType,
      size: input.size,
      encryptedPath: input.encryptedPath,
      encryptedData: input.encryptedData,
      thumbnailPath: null,
      metadata: input.metadata,
      isFavorite: false,
      isDeleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    return this.itemRepository.create(item);
  }
}
