import { DIContainer } from './container';
import { DatabaseService } from '@data/database/DatabaseService';
import { MigrationRunner } from '@data/database/MigrationRunner';
import { VaultRepositoryImpl } from '@data/repositories/VaultRepositoryImpl';
import { ItemRepositoryImpl } from '@data/repositories/ItemRepositoryImpl';
import { NoteRepositoryImpl } from '@data/repositories/NoteRepositoryImpl';
import { PasswordRepositoryImpl } from '@data/repositories/PasswordRepositoryImpl';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';
import { SecurityQuestionRepositoryImpl } from '@data/repositories/SecurityQuestionRepositoryImpl';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { FileSystemSource } from '@data/datasources/FileSystemSource';
import { CreateVaultUseCase } from '@domain/usecases/vault/CreateVaultUseCase';
import { GetVaultsUseCase } from '@domain/usecases/vault/GetVaultsUseCase';
import { DeleteVaultUseCase } from '@domain/usecases/vault/DeleteVaultUseCase';
import { LockVaultUseCase } from '@domain/usecases/vault/LockVaultUseCase';
import { UnlockVaultUseCase } from '@domain/usecases/vault/UnlockVaultUseCase';
import { ChangePinUseCase } from '@domain/usecases/vault/ChangePinUseCase';
import { AddItemUseCase } from '@domain/usecases/item/AddItemUseCase';
import { DeleteItemUseCase } from '@domain/usecases/item/DeleteItemUseCase';
import { SearchItemsUseCase } from '@domain/usecases/item/SearchItemsUseCase';
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';
import { SetupSecurityQuestionsUseCase } from '@domain/usecases/security/SetupSecurityQuestionsUseCase';
import { VerifySecurityAnswersUseCase } from '@domain/usecases/security/VerifySecurityAnswersUseCase';
import { ResetPinWithSecurityQuestionsUseCase } from '@domain/usecases/security/ResetPinWithSecurityQuestionsUseCase';
import { GetSecurityQuestionsUseCase } from '@domain/usecases/security/GetSecurityQuestionsUseCase';
import { up as migration001Up, down as migration001Down } from '@data/database/migrations/001_initial';
import { up as migration002Up, down as migration002Down } from '@data/database/migrations/002_indexes';
import { up as migration003Up, down as migration003Down } from '@data/database/migrations/003_repair_vault_columns';
import { up as migration004Up, down as migration004Down } from '@data/database/migrations/004_security_questions';

/** Creates and configures the migration runner with all registered migrations. */
export function createMigrationRunner(): MigrationRunner {
  const runner = new MigrationRunner();
  runner.register({ version: 1, name: 'initial', up: migration001Up, down: migration001Down });
  runner.register({ version: 2, name: 'indexes', up: migration002Up, down: migration002Down });
  runner.register({ version: 3, name: 'repair-vault-columns', up: migration003Up, down: migration003Down });
  runner.register({ version: 4, name: 'security-questions', up: migration004Up, down: migration004Down });
  return runner;
}

/** Registers all application dependencies (data sources, repositories, use cases) with the DI container. */
export function registerDependencies(): void {
  // Data Sources
  DIContainer.registerSingleton('DatabaseService', () => new DatabaseService());
  DIContainer.registerSingleton('SecureStorageSource', () => new SecureStorageSource());
  DIContainer.registerSingleton('FileSystemSource', () => new FileSystemSource(
    DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
  ));

  // Migration Runner
  const migrationRunner = createMigrationRunner();
  DIContainer.registerSingleton('MigrationRunner', () => migrationRunner);

  // Repositories
  DIContainer.registerSingleton('VaultRepository', () =>
    new VaultRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
  );
  DIContainer.registerSingleton('ItemRepository', () =>
    new ItemRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
  );
  DIContainer.registerSingleton('NoteRepository', () =>
    new NoteRepositoryImpl(
      DIContainer.resolve<DatabaseService>('DatabaseService'),
      DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
    ),
  );
  DIContainer.registerSingleton('PasswordRepository', () =>
    new PasswordRepositoryImpl(
      DIContainer.resolve<DatabaseService>('DatabaseService'),
      DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
    ),
  );
  DIContainer.registerSingleton('ActivityLogRepository', () =>
    new ActivityLogRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
  );
  DIContainer.registerSingleton('SecurityQuestionRepository', () =>
    new SecurityQuestionRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
  );

  // Use Cases
  DIContainer.registerSingleton('CreateVaultUseCase', () =>
    new CreateVaultUseCase(
      DIContainer.resolve<VaultRepositoryImpl>('VaultRepository'),
      DIContainer.resolve<BiometricUnlockUseCase>('BiometricUnlockUseCase'),
    ),
  );
  DIContainer.registerSingleton('GetVaultsUseCase', () =>
    new GetVaultsUseCase(DIContainer.resolve<VaultRepositoryImpl>('VaultRepository')),
  );
  DIContainer.registerSingleton('DeleteVaultUseCase', () =>
    new DeleteVaultUseCase(DIContainer.resolve<VaultRepositoryImpl>('VaultRepository')),
  );
  DIContainer.registerSingleton('LockVaultUseCase', () =>
    new LockVaultUseCase(DIContainer.resolve<VaultRepositoryImpl>('VaultRepository')),
  );
  DIContainer.registerSingleton('UnlockVaultUseCase', () =>
    new UnlockVaultUseCase(DIContainer.resolve<VaultRepositoryImpl>('VaultRepository')),
  );
  DIContainer.registerSingleton('ChangePinUseCase', () =>
    new ChangePinUseCase(
      DIContainer.resolve<VaultRepositoryImpl>('VaultRepository'),
      DIContainer.resolve<BiometricUnlockUseCase>('BiometricUnlockUseCase'),
    ),
  );
  DIContainer.registerSingleton('AddItemUseCase', () =>
    new AddItemUseCase(DIContainer.resolve<ItemRepositoryImpl>('ItemRepository')),
  );
  DIContainer.registerSingleton('DeleteItemUseCase', () =>
    new DeleteItemUseCase(DIContainer.resolve<ItemRepositoryImpl>('ItemRepository')),
  );
  DIContainer.registerSingleton('SearchItemsUseCase', () =>
    new SearchItemsUseCase(DIContainer.resolve<ItemRepositoryImpl>('ItemRepository')),
  );
  DIContainer.registerSingleton('BiometricUnlockUseCase', () =>
    new BiometricUnlockUseCase(
      DIContainer.resolve<VaultRepositoryImpl>('VaultRepository'),
      DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
    ),
  );
  DIContainer.registerSingleton('SetupSecurityQuestionsUseCase', () =>
    new SetupSecurityQuestionsUseCase(
      DIContainer.resolve<VaultRepositoryImpl>('VaultRepository'),
      DIContainer.resolve<SecurityQuestionRepositoryImpl>('SecurityQuestionRepository'),
    ),
  );
  DIContainer.registerSingleton('VerifySecurityAnswersUseCase', () =>
    new VerifySecurityAnswersUseCase(
      DIContainer.resolve<SecurityQuestionRepositoryImpl>('SecurityQuestionRepository'),
    ),
  );
  DIContainer.registerSingleton('ResetPinWithSecurityQuestionsUseCase', () =>
    new ResetPinWithSecurityQuestionsUseCase(
      DIContainer.resolve<VaultRepositoryImpl>('VaultRepository'),
      DIContainer.resolve<SecurityQuestionRepositoryImpl>('SecurityQuestionRepository'),
      DIContainer.resolve<BiometricUnlockUseCase>('BiometricUnlockUseCase'),
    ),
  );
  DIContainer.registerSingleton('GetSecurityQuestionsUseCase', () =>
    new GetSecurityQuestionsUseCase(
      DIContainer.resolve<SecurityQuestionRepositoryImpl>('SecurityQuestionRepository'),
    ),
  );
}
