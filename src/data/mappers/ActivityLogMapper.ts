import { ActivityLogEntry } from '@domain/entities/ActivityLog';
import { ActivityLogDTO } from '@data/dto/ActivityLogDTO';
import { ActivityAction } from '@core/constants';

/** Maps between ActivityLogEntry domain entities and ActivityLogDTO data transfer objects. */
export class ActivityLogMapper {
  /** Converts an ActivityLogDTO to an ActivityLogEntry domain entity. */
  toEntity(dto: ActivityLogDTO): ActivityLogEntry {
    return {
      id: dto.id,
      vaultId: dto.vault_id,
      action: dto.action as ActivityAction,
      targetType: dto.target_type,
      targetId: dto.target_id,
      metadata: dto.metadata_json ? JSON.parse(dto.metadata_json) : null,
      createdAt: dto.created_at,
    };
  }

  /** Converts an ActivityLogEntry domain entity to an ActivityLogDTO. */
  toDTO(entity: ActivityLogEntry): ActivityLogDTO {
    return {
      id: entity.id,
      vault_id: entity.vaultId,
      action: entity.action,
      target_type: entity.targetType,
      target_id: entity.targetId,
      metadata_json: entity.metadata ? JSON.stringify(entity.metadata) : null,
      created_at: entity.createdAt,
    };
  }
}
