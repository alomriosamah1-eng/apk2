import { DIContainer } from './container';
import { DatabaseService } from '@data/database/DatabaseService';
import { MigrationRunner } from '@data/database/MigrationRunner';
import { VaultRepositoryImpl } from '@data/repositories/VaultRepositoryImpl';
import { ItemRepositoryImpl } from '@data/repositories/ItemRepositoryImpl';
import { NoteRepositoryImpl } from '@data/repositories/NoteRepositoryImpl';
import { PasswordRepositoryImpl } from '@data/repositories/PasswordRepositoryImpl';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';
import { SettingsRepositoryImpl } from '@data/repositories/SettingsRepositoryImpl';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { FileSystemSource } from '@data/datasources/FileSystemSource';
import { CreateVaultUseCase } from '@domain/usecases/vault/CreateVaultUseCase';
import { GetVaultsUseCase } from '@domain/usecases/vault/GetVaultsUseCase';
import { DeleteVaultUseCase } from '@domain/usecases/vault/DeleteVaultUseCase';
import { LockVaultUseCase } from '@domain/usecases/vault/LockVaultUseCase';
import { UnlockVaultUseCase } from '@domain/usecases/vault/UnlockVaultUseCase';
import { AddItemUseCase } from '@domain/usecases/item/AddItemUseCase';
import { DeleteItemUseCase } from '@domain/usecases/item/DeleteItemUseCase';
import { SearchItemsUseCase } from '@domain/usecases/item/SearchItemsUseCase';
import { AuthenticateUseCase } from '@domain/usecases/auth/AuthenticateUseCase';
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';
import { up as migration001Up, down as migration001Down } from '@data/database/migrations/001_initial';
import { up as migration002Up, down as migration002Down } from '@data/database/migrations/002_indexes';

/** Creates and configures the migration runner with all registered migrations. */
export function createMigrationRunner(): MigrationRunner {
  const runner = new MigrationRunner();
  runner.register({ version: 1, name: 'initial', up: migration001Up, down: migration001Down });
  runner.register({ version: 2, name: 'indexes', up: migration002Up, down: migration002Down });
  return runner;
}

/** Registers all application dependencies (data sources, repositories, use cases) with the DI container. */
export function registerDependencies(): void {
  // Data Sources
  DIContainer.registerSingleton('DatabaseService', () => new DatabaseService());
  DIContainer.registerSingleton('SecureStorageSource', () => new SecureStorageSource());
  DIContainer.registerSingleton('FileSystemSource', () => new FileSystemSource());

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
    new NoteRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
  );
  DIContainer.registerSingleton('PasswordRepository', () =>
    new PasswordRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
  );
  DIContainer.registerSingleton('ActivityLogRepository', () =>
    new ActivityLogRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
  );
  DIContainer.registerSingleton('SettingsRepository', () =>
    new SettingsRepositoryImpl(DIContainer.resolve<DatabaseService>('DatabaseService')),
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
  DIContainer.registerSingleton('AddItemUseCase', () =>
    new AddItemUseCase(DIContainer.resolve<ItemRepositoryImpl>('ItemRepository')),
  );
  DIContainer.registerSingleton('DeleteItemUseCase', () =>
    new DeleteItemUseCase(DIContainer.resolve<ItemRepositoryImpl>('ItemRepository')),
  );
  DIContainer.registerSingleton('SearchItemsUseCase', () =>
    new SearchItemsUseCase(DIContainer.resolve<ItemRepositoryImpl>('ItemRepository')),
  );
  DIContainer.registerSingleton('AuthenticateUseCase', () =>
    new AuthenticateUseCase(),
  );

  DIContainer.registerSingleton('BiometricUnlockUseCase', () =>
    new BiometricUnlockUseCase(
      DIContainer.resolve<VaultRepositoryImpl>('VaultRepository'),
      DIContainer.resolve<SecureStorageSource>('SecureStorageSource'),
    ),
  );
}
