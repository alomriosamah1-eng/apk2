import { DatabaseService } from '../DatabaseService';

/** Creates additional indexes for performance. */
export async function up(db: DatabaseService): Promise<void> {
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_items_vault_id ON items(vault_id)');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id)');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at)');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_vaults_updated_at ON vaults(updated_at)');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_activity_log_vault_id ON activity_log(vault_id)');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)');
}

/** Drops all indexes created by this migration. */
export async function down(db: DatabaseService): Promise<void> {
  await db.executeSql('DROP INDEX IF EXISTS idx_items_vault_id');
  await db.executeSql('DROP INDEX IF EXISTS idx_items_parent_id');
  await db.executeSql('DROP INDEX IF EXISTS idx_items_updated_at');
  await db.executeSql('DROP INDEX IF EXISTS idx_items_type');
  await db.executeSql('DROP INDEX IF EXISTS idx_vaults_updated_at');
  await db.executeSql('DROP INDEX IF EXISTS idx_activity_log_vault_id');
  await db.executeSql('DROP INDEX IF EXISTS idx_activity_log_created_at');
}
