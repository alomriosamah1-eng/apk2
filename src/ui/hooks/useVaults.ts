import { useState, useEffect, useCallback } from 'react';
import { Vault } from '@domain/entities/Vault';
import { GetVaultsUseCase } from '@domain/usecases/vault/GetVaultsUseCase';
import { CreateVaultUseCase, CreateVaultInput } from '@domain/usecases/vault/CreateVaultUseCase';
import { DeleteVaultUseCase } from '@domain/usecases/vault/DeleteVaultUseCase';
import { LockVaultUseCase } from '@domain/usecases/vault/LockVaultUseCase';
import { UnlockVaultUseCase } from '@domain/usecases/vault/UnlockVaultUseCase';
import { DIContainer } from '@core/di/container';

export function useVaults() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getVaultsUseCase = DIContainer.resolve<GetVaultsUseCase>('GetVaultsUseCase');
  const createVaultUseCase = DIContainer.resolve<CreateVaultUseCase>('CreateVaultUseCase');
  const deleteVaultUseCase = DIContainer.resolve<DeleteVaultUseCase>('DeleteVaultUseCase');
  const lockVaultUseCase = DIContainer.resolve<LockVaultUseCase>('LockVaultUseCase');
  const unlockVaultUseCase = DIContainer.resolve<UnlockVaultUseCase>('UnlockVaultUseCase');

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
    }
    return result;
  }, [createVaultUseCase]);

  const deleteVault = useCallback(async (id: string) => {
    const result = await deleteVaultUseCase.execute(id);
    if (result.success) {
      setVaults((prev) => prev.filter((v) => v.id !== id));
    }
    return result;
  }, [deleteVaultUseCase]);

  const lockVault = useCallback(async (id: string) => {
    const result = await lockVaultUseCase.execute(id);
    if (result.success) {
      setVaults((prev) => prev.map((v) => (v.id === id ? { ...v, isLocked: true } : v)));
    }
    return result;
  }, [lockVaultUseCase]);

  const unlockVault = useCallback(async (id: string, pin: string) => {
    const result = await unlockVaultUseCase.execute(id, pin);
    if (result.success) {
      setVaults((prev) => prev.map((v) => (v.id === id ? { ...v, isLocked: false } : v)));
    }
    return result;
  }, [unlockVaultUseCase]);

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
