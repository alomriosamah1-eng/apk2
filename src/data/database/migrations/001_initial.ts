import { DatabaseService } from '../DatabaseService';
import { SCHEMA } from '../schema';

/** Applies the initial schema (all tables and indexes). */
export async function up(db: DatabaseService): Promise<void> {
  await db.execSql(SCHEMA);
}

/** Drops all tables created by the initial migration. */
export async function down(db: DatabaseService): Promise<void> {
  await db.executeSql('DROP TABLE IF EXISTS activity_log');
  await db.executeSql('DROP TABLE IF EXISTS passwords');
  await db.executeSql('DROP TABLE IF EXISTS notes');
  await db.executeSql('DROP TABLE IF EXISTS items');
  await db.executeSql('DROP TABLE IF EXISTS vaults');
}
