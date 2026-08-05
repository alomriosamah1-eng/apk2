import { SecurityQuestion } from '@domain/entities/SecurityQuestion';
import { SecurityQuestionDTO } from '@data/dto/SecurityQuestionDTO';

/** Maps between SecurityQuestion domain entities and SecurityQuestionDTO records. */
export class SecurityQuestionMapper {
  /** Converts a SecurityQuestionDTO to a SecurityQuestion domain entity. */
  toEntity(dto: SecurityQuestionDTO): SecurityQuestion {
    return {
      id: dto.id,
      vaultId: dto.vault_id,
      question: dto.question,
      answerHash: dto.answer_hash,
      answerSalt: dto.answer_salt,
      position: dto.position,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
    };
  }

  /** Converts a SecurityQuestion domain entity to a SecurityQuestionDTO. */
  toDTO(entity: SecurityQuestion): SecurityQuestionDTO {
    return {
      id: entity.id,
      vault_id: entity.vaultId,
      question: entity.question,
      answer_hash: entity.answerHash,
      answer_salt: entity.answerSalt,
      position: entity.position,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}