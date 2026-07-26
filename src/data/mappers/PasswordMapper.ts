import { PasswordEntry } from '@domain/entities/Password';
import { PasswordDTO } from '@data/dto/PasswordDTO';

/** Maps between PasswordEntry domain entities and PasswordDTO data transfer objects. */
export class PasswordMapper {
  /** Converts a PasswordDTO to a PasswordEntry domain entity. */
  toEntity(dto: PasswordDTO): PasswordEntry {
    return {
      id: dto.id,
      vaultId: dto.vault_id,
      serviceName: dto.service_name,
      serviceUrl: dto.service_url,
      username: dto.username,
      encryptedPassword: dto.encrypted_password,
      category: dto.category,
      notes: dto.notes,
      strengthScore: dto.strength_score,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
      lastUsedAt: dto.last_used_at,
    };
  }

  /** Converts a PasswordEntry domain entity to a PasswordDTO. */
  toDTO(entity: PasswordEntry): PasswordDTO {
    return {
      id: entity.id,
      vault_id: entity.vaultId,
      service_name: entity.serviceName,
      service_url: entity.serviceUrl,
      username: entity.username,
      encrypted_password: entity.encryptedPassword,
      category: entity.category,
      notes: entity.notes,
      strength_score: entity.strengthScore,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      last_used_at: entity.lastUsedAt,
    };
  }
}
