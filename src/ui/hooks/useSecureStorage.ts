import { useState, useCallback } from 'react';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

const secureStorage = new SecureStorageSource();

export function useSecureStorage() {
  const [loading, setLoading] = useState(false);

  const setItem = useCallback(async (key: string, value: string): Promise<void> => {
    setLoading(true);
    try {
      await secureStorage.set(key, value);
    } finally {
      setLoading(false);
    }
  }, []);

  const getItem = useCallback(async (key: string): Promise<string | null> => {
    return secureStorage.get(key);
  }, []);

  const deleteItem = useCallback(async (key: string): Promise<void> => {
    await secureStorage.delete(key);
  }, []);

  return { setItem, getItem, deleteItem, loading };
}
