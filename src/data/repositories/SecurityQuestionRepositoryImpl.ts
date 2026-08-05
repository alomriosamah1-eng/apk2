import { ISecurityQuestionRepository } from '@domain/repositories/ISecurityQuestionRepository';
import { SecurityQuestion } from '@domain/entities/SecurityQuestion';
import { Result, success, failure, DatabaseError } from '@core/errors';
import { SecurityQuestionDTO } from '@data/dto/SecurityQuestionDTO';
import { SecurityQuestionMapper } from '@data/mappers/SecurityQuestionMapper';
import { DatabaseService } from '@data/database/DatabaseService';

/** Implementation of ISecurityQuestionRepository backed by SQLite via DatabaseService. */
export class SecurityQuestionRepositoryImpl implements ISecurityQuestionRepository {
  private mapper = new SecurityQuestionMapper();

  constructor(private db: DatabaseService) {}

  private readonly COLUMNS = 'id, vault_id, question, answer_hash, answer_salt, position, created_at, updated_at';

  /** Returns the security questions for a vault, ordered by position. */
  async findByVaultId(vaultId: string): Promise<Result<SecurityQuestion[]>> {
    try {
      const rows = await this.db.query<SecurityQuestionDTO>(
        `SELECT ${this.COLUMNS} FROM security_questions WHERE vault_id = ? ORDER BY position ASC`,
        [vaultId],
      );
      return success(rows.map((r) => this.mapper.toEntity(r)));
    } catch (error) {
      return failure(new DatabaseError('Failed to fetch security questions', (error as Error).message));
    }
  }

  /** Replaces all security questions for a vault in a single transaction. */
  async replaceForVault(vaultId: string, questions: SecurityQuestion[]): Promise<Result<void>> {
    try {
      await this.db.transaction(async () => {
        await this.db.executeSql('DELETE FROM security_questions WHERE vault_id = ?', [vaultId]);
        for (const question of questions) {
          const dto = this.mapper.toDTO(question);
          await this.db.executeSql(
            `INSERT INTO security_questions (id, vault_id, question, answer_hash, answer_salt, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [dto.id, dto.vault_id, dto.question, dto.answer_hash, dto.answer_salt, dto.position, dto.created_at, dto.updated_at],
          );
        }
      });
      return success(undefined);
    } catch (error) {
      return failure(new DatabaseError('Failed to save security questions', (error as Error).message));
    }
  }
}