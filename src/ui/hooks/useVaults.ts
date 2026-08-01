import { useState, useEffect, useCallback } from 'react';
import { Paths, Directory } from 'expo-file-system';
import { Vault } from '@domain/entities/Vault';
import { GetVaultsUseCase } from '@domain/usecases/vault/GetVaultsUseCase';
import { CreateVaultUseCase, CreateVaultInput } from '@domain/usecases/vault/CreateVaultUseCase';
import { DeleteVaultUseCase } from '@domain/usecases/vault/DeleteVaultUseCase';
import { LockVaultUseCase } from '@domain/usecases/vault/LockVaultUseCase';
import { UnlockVaultUseCase } from '@domain/usecases/vault/UnlockVaultUseCase';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';
import { DIContainer } from '@core/di/container';
import { ActivityAction } from '@core/constants';

export function useVaults() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getVaultsUseCase = DIContainer.resolve<GetVaultsUseCase>('GetVaultsUseCase');
  const createVaultUseCase = DIContainer.resolve<CreateVaultUseCase>('CreateVaultUseCase');
  const deleteVaultUseCase = DIContainer.resolve<DeleteVaultUseCase>('DeleteVaultUseCase');
  const lockVaultUseCase = DIContainer.resolve<LockVaultUseCase>('LockVaultUseCase');
  const unlockVaultUseCase = DIContainer.resolve<UnlockVaultUseCase>('UnlockVaultUseCase');

  const logActivity = useCallback((action: ActivityAction, targetId?: string, metadata?: Record<string, unknown>) => {
    const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
    void repo.log(action, 'vault', targetId, metadata);
  }, []);

  const loadVaults = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getVaultsUseCase.execute();
    if (result.success) {
      setVaults(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [getVaultsUseCase]);

  const createVault = useCallback(async (input: CreateVaultInput) => {
    const result = await createVaultUseCase.execute(input);
    if (result.success) {
      setVaults((prev) => [result.data, ...prev]);
      logActivity(ActivityAction.CREATE_VAULT, result.data.id, { name: result.data.name });
    }
    return result;
  }, [createVaultUseCase, logActivity]);

  const deleteVault = useCallback(async (id: string) => {
    const result = await deleteVaultUseCase.execute(id);
    if (result.success) {
      setVaults((prev) => prev.filter((v) => v.id !== id));
      logActivity(ActivityAction.DELETE_VAULT, id);
      const vaultDir = new Directory(Paths.document, 'khaznati', id);
      if (vaultDir.exists) {
        vaultDir.delete();
      }
    }
    return result;
  }, [deleteVaultUseCase, logActivity]);

  const lockVault = useCallback(async (id: string) => {
    const result = await lockVaultUseCase.execute(id);
    if (result.success) {
      setVaults((prev) => prev.map((v) => (v.id === id ? { ...v, isLocked: true } : v)));
      logActivity(ActivityAction.LOCK_VAULT, id);
    }
    return result;
  }, [lockVaultUseCase, logActivity]);

  const unlockVault = useCallback(async (id: string, pin: string) => {
    const result = await unlockVaultUseCase.execute(id, pin);
    if (result.success) {
      setVaults((prev) => prev.map((v) => (v.id === id ? { ...v, isLocked: false } : v)));
      logActivity(ActivityAction.UNLOCK_VAULT, id);
    }
    return result;
  }, [unlockVaultUseCase, logActivity]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  return {
    vaults,
    loading,
    error,
    loadVaults,
    createVault,
    deleteVault,
    lockVault,
    unlockVault,
  };
}
