import { Vault } from '@domain/entities/Vault';
import { VaultDTO } from '@data/dto/VaultDTO';
import { VaultType } from '@core/constants';

/** Maps between Vault domain entities and VaultDTO data transfer objects. */
export class VaultMapper {
  /** Converts a VaultDTO to a Vault domain entity. */
  toEntity(dto: VaultDTO): Vault {
    return {
      id: dto.id,
      name: dto.name,
      type: dto.type as VaultType,
      icon: dto.icon,
      color: dto.color,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
      lastAccessedAt: dto.last_accessed_at,
      isLocked: dto.is_locked === 1,
      encryptedPinHash: dto.encrypted_pin_hash,
      pinSalt: dto.pin_salt,
      failedAttempts: dto.failed_attempts,
      lockedUntil: dto.locked_until,
      itemCount: dto.item_count,
      totalSize: dto.total_size,
    };
  }

  /** Converts a Vault domain entity to a VaultDTO. */
  toDTO(entity: Vault): VaultDTO {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      icon: entity.icon,
      color: entity.color,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      last_accessed_at: entity.lastAccessedAt,
      is_locked: entity.isLocked ? 1 : 0,
      encrypted_pin_hash: entity.encryptedPinHash,
      pin_salt: entity.pinSalt,
      failed_attempts: entity.failedAttempts,
      locked_until: entity.lockedUntil,
      item_count: entity.itemCount,
      total_size: entity.totalSize,
    };
  }
}
