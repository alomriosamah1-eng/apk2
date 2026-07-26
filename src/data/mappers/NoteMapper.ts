import { Note } from '@domain/entities/Note';
import { NoteDTO } from '@data/dto/NoteDTO';

/** Maps between Note domain entities and NoteDTO data transfer objects. */
export class NoteMapper {
  /** Converts a NoteDTO to a Note domain entity. */
  toEntity(dto: NoteDTO): Note {
    return {
      id: dto.id,
      vaultId: dto.vault_id,
      title: dto.title,
      encryptedContent: dto.encrypted_content,
      isEncrypted: dto.is_encrypted === 1,
      color: dto.color,
      isPinned: dto.is_pinned === 1,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
    };
  }

  /** Converts a Note domain entity to a NoteDTO. */
  toDTO(entity: Note): NoteDTO {
    return {
      id: entity.id,
      vault_id: entity.vaultId,
      title: entity.title,
      encrypted_content: entity.encryptedContent,
      is_encrypted: entity.isEncrypted ? 1 : 0,
      color: entity.color,
      is_pinned: entity.isPinned ? 1 : 0,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
