import { DatabaseService } from '../DatabaseService';

/**
 * Creates the `security_questions` table that backs PIN recovery. Answers are
 * stored as PBKDF2 hashes (never plaintext); only the question text is stored
 * in the clear. Deleting a vault cascades to its questions.
 */
export async function up(db: DatabaseService): Promise<void> {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS security_questions (
        id TEXT PRIMARY KEY NOT NULL,
        vault_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer_hash TEXT NOT NULL,
        answer_salt TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
    )
  `);
  await db.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_security_questions_vault_id ON security_questions(vault_id)',
  );
}

/** Drops the security_questions table created by this migration. */
export async function down(db: DatabaseService): Promise<void> {
  await db.executeSql('DROP TABLE IF EXISTS security_questions');
}