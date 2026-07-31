import { Paths, Directory, File } from 'expo-file-system';
import { DIContainer } from '@core/di/container';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { ItemType } from '@core/constants';
import { generateId } from '@core/utils';
import { generateEncryptionKey } from '@core/utils/crypto';

export async function getVaultKey(vaultId: string): Promise<string> {
  const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
  const keyKey = `media_vault_key_${vaultId}`;
  let key = await storage.get(keyKey);
  if (!key) {
    key = await generateEncryptionKey();
    await storage.set(keyKey, key);
  }
  return key;
}

export function getEncryptedDir(vaultId: string): Directory {
  return new Directory(Paths.document, 'khaznati', vaultId || 'default', '.encrypted_media');
}

interface PersistImageParams {
  vaultId: string;
  name: string;
  mimeType: string;
  size: number;
  encryptedBase64: string;
}

export async function persistEncryptedImage({ vaultId, name, mimeType, size, encryptedBase64 }: PersistImageParams): Promise<void> {
  const itemRepo = DIContainer.resolve<IItemRepository>('ItemRepository');
  const encDir = getEncryptedDir(vaultId);
  if (!encDir.exists) encDir.create({ intermediates: true, idempotent: true });
  const ext = (name.split('.').pop() || 'jpg');
  const encFileName = `${Date.now()}.${ext}.enc`;
  const encFile = new File(encDir, encFileName);
  await encFile.write(encryptedBase64);

  await itemRepo.create({
    id: generateId(),
    vaultId,
    parentId: null,
    name,
    type: ItemType.IMAGE,
    mimeType,
    size,
    encryptedPath: encFile.uri,
    encryptedData: null,
    thumbnailPath: null,
    metadata: null,
    isFavorite: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  });
}
