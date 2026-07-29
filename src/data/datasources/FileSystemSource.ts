import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { encryptData, decryptData, generateEncryptionKey } from '@core/utils/crypto';
import { SecureStorageSource } from './SecureStorageSource';
import { DIContainer } from '@core/di/container';

export class FileSystemSource {
  private basePath: string;

  constructor() {
    this.basePath = `${FileSystem.documentDirectory}khaznati`;
  }

  async initialize(): Promise<void> {
    const dirs = [
      this.basePath,
      `${this.basePath}/files`,
      `${this.basePath}/thumbnails`,
      `${this.basePath}/backups`,
      `${this.basePath}/temp`,
    ];

    for (const dir of dirs) {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    }

    const nomediaPath = `${this.basePath}/.nomedia`;
    const nomediaInfo = await FileSystem.getInfoAsync(nomediaPath);
    if (!nomediaInfo.exists) {
      await FileSystem.writeAsStringAsync(nomediaPath, '', {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
  }

  private async getVaultKey(vaultId: string): Promise<string> {
    const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
    const keyKey = `file_vault_key_${vaultId}`;
    let key = await storage.get(keyKey);
    if (!key) {
      key = await generateEncryptionKey();
      await storage.set(keyKey, key);
    }
    return key;
  }

  async writeFile(path: string, data: string): Promise<void> {
    const fullPath = `${this.basePath}/files/${path}`;
    const vaultId = path.split('/')[0] || 'default';
    const vaultKey = await this.getVaultKey(vaultId);
    const encrypted = await encryptData(vaultKey, data);
    await FileSystem.writeAsStringAsync(fullPath, encrypted, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  async readFile(path: string): Promise<string> {
    const fullPath = `${this.basePath}/files/${path}`;
    const vaultId = path.split('/')[0] || 'default';
    const vaultKey = await this.getVaultKey(vaultId);
    const encrypted = await FileSystem.readAsStringAsync(fullPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return decryptData(vaultKey, encrypted);
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = `${this.basePath}/files/${path}`;
    await FileSystem.deleteAsync(fullPath, { idempotent: true });
  }

  async fileExists(path: string): Promise<boolean> {
    const fullPath = `${this.basePath}/files/${path}`;
    const info = await FileSystem.getInfoAsync(fullPath);
    return info.exists;
  }

  async getFileSize(path: string): Promise<number> {
    const fullPath = `${this.basePath}/files/${path}`;
    const info = await FileSystem.getInfoAsync(fullPath);
    return (info as FileSystem.FileInfo & { size: number }).size ?? 0;
  }

  async copyFile(source: string, destination: string): Promise<void> {
    const srcPath = `${this.basePath}/files/${source}`;
    const destPath = `${this.basePath}/files/${destination}`;
    await FileSystem.copyAsync({ from: srcPath, to: destPath });
  }

  async moveFile(source: string, destination: string): Promise<void> {
    const srcPath = `${this.basePath}/files/${source}`;
    const destPath = `${this.basePath}/files/${destination}`;
    await FileSystem.moveAsync({ from: srcPath, to: destPath });
  }

  async listFiles(directory: string): Promise<string[]> {
    const dirPath = `${this.basePath}/files/${directory}`;
    return FileSystem.readDirectoryAsync(dirPath);
  }

  async getStorageInfo(): Promise<{ used: number; free: number }> {
    const totalSize = await this.calculateDirectorySize(this.basePath);
    return { used: totalSize, free: 0 };
  }

  async secureDelete(path: string): Promise<void> {
    const fullPath = `${this.basePath}/files/${path}`;
    const size = await this.getFileSize(path);
    const chunkSize = 4096;
    const chunks = Math.ceil(size / chunkSize);

    for (let i = 0; i < Math.min(chunks, 3); i++) {
      const randomBytes = Crypto.getRandomBytes(chunkSize);
      const randomData = this.uint8ArrayToBase64(randomBytes);
      await FileSystem.writeAsStringAsync(fullPath, randomData, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    await this.deleteFile(path);
  }

  getBasePath(): string {
    return this.basePath;
  }

  getVaultPath(vaultId: string): string {
    return `${this.basePath}/files/${vaultId}`;
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    try {
      const contents = await FileSystem.readDirectoryAsync(dirPath);
      let total = 0;
      for (const item of contents) {
        const itemPath = `${dirPath}/${item}`;
        const info = await FileSystem.getInfoAsync(itemPath);
        if (info.exists) {
          if (info.isDirectory) {
            total += await this.calculateDirectorySize(itemPath);
          } else {
            total += (info as FileSystem.FileInfo & { size: number }).size ?? 0;
          }
        }
      }
      return total;
    } catch {
      return 0;
    }
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i] as number;
      const b2 = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
      const b3 = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
      result += chars[b1 >> 2];
      result += chars[((b1 & 3) << 4) | (b2 >> 4)];
      result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
      result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
    }
    return result;
  }
}
