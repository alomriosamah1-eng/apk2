import * as SecureStore from 'expo-secure-store';
import { ISecureStorage } from '@domain/repositories/ISecureStorage';

/** Wraps expo-secure-store for persistent, encrypted key-value storage. */
export class SecureStorageSource implements ISecureStorage {
  /** Stores a value under the given key in secure storage. */
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  /** Retrieves the value for a given key, or null if not found. */
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  /** Deletes the value for a given key from secure storage. */
  async delete(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  /** Checks whether a key exists in secure storage. */
  async contains(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /** Returns whether secure storage is available on the current device. */
  async isAvailable(): Promise<boolean> {
    return SecureStore.isAvailableAsync();
  }
}
