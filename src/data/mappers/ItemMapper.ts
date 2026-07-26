import { Item } from '@domain/entities/Item';
import { ItemDTO } from '@data/dto/ItemDTO';
import { ItemType } from '@core/constants';

/** Maps between Item domain entities and ItemDTO data transfer objects. */
export class ItemMapper {
  /** Converts an ItemDTO to an Item domain entity. */
  toEntity(dto: ItemDTO): Item {
    return {
      id: dto.id,
      vaultId: dto.vault_id,
      parentId: dto.parent_id,
      name: dto.name,
      type: dto.type as ItemType,
      mimeType: dto.mime_type,
      size: dto.size,
      encryptedPath: dto.encrypted_path,
      encryptedData: dto.encrypted_data,
      thumbnailPath: dto.thumbnail_path,
      metadata: dto.metadata_json ? JSON.parse(dto.metadata_json) : null,
      isFavorite: dto.is_favorite === 1,
      isDeleted: dto.is_deleted === 1,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
      deletedAt: dto.deleted_at,
    };
  }

  /** Converts an Item domain entity to an ItemDTO. */
  toDTO(entity: Item): ItemDTO {
    return {
      id: entity.id,
      vault_id: entity.vaultId,
      parent_id: entity.parentId,
      name: entity.name,
      type: entity.type,
      mime_type: entity.mimeType,
      size: entity.size,
      encrypted_path: entity.encryptedPath,
      encrypted_data: entity.encryptedData,
      thumbnail_path: entity.thumbnailPath,
      metadata_json: entity.metadata ? JSON.stringify(entity.metadata) : null,
      is_favorite: entity.isFavorite ? 1 : 0,
      is_deleted: entity.isDeleted ? 1 : 0,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      deleted_at: entity.deletedAt,
    };
  }
}
