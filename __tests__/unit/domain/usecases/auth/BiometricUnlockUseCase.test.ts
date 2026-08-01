import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { ISecureStorage } from '@domain/repositories/ISecureStorage';
import { Vault } from '@domain/entities/Vault';
import { VaultType } from '@core/constants';
import { success, AuthenticationError } from '@core/errors';
import { generateSalt, hashPin } from '@core/utils';

jest.mock('expo-crypto');

const now = Date.now();

function makeVault(overrides: Partial<Vault> = {}): Vault {
  return {
    id: 'vault-1',
    name: 'Personal',
    type: VaultType.PERSONAL,
    icon: 'lock',
    color: '#000',
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: null,
    isLocked: true,
    encryptedPinHash: '',
    pinSalt: '',
    failedAttempts: 0,
    lockedUntil: null,
    itemCount: 0,
    totalSize: 0,
    ...overrides,
  };
}

function makeSecureStorage(): jest.Mocked<ISecureStorage> {
  const map = new Map<string, string>();
  return {
    get: jest.fn(async (key) => map.get(key) ?? null),
    set: jest.fn(async (key, value) => { map.set(key, value); }),
    delete: jest.fn(async (key) => { map.delete(key); }),
    contains: jest.fn(async (key) => map.has(key)),
  };
}

describe('BiometricUnlockUseCase', () => {
  let mockRepo: jest.Mocked<IVaultRepository>;
  let storage: jest.Mocked<ISecureStorage>;
  let useCase: BiometricUnlockUseCase;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateLastAccessed: jest.fn(),
      lock: jest.fn(),
      unlock: jest.fn().mockImplementation(async () => success(undefined)),
      updateFields: jest.fn().mockImplementation(async () => success(undefined)),
      count: jest.fn(),
    };
    storage = makeSecureStorage();
    useCase = new BiometricUnlockUseCase(mockRepo, storage);
  });

  it('stores an encrypted token and unlocks with it', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
    })));

    await useCase.storeBiometricPin('vault-1', '1234');
    expect(await useCase.hasBiometricPin('vault-1')).toBe(true);

    const storedToken = await storage.get('biometric_token_vault-1');
    expect(storedToken).toBeTruthy();
    expect(storedToken).not.toContain('1234');

    const result = await useCase.execute('vault-1');
    expect(result.success).toBe(true);
    expect(mockRepo.unlock).toHaveBeenCalledWith('vault-1');
  });

  it('returns AUTH_FAILED when no token is stored', async () => {
    const result = await useCase.execute('vault-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
    expect(mockRepo.unlock).not.toHaveBeenCalled();
  });

  it('returns AUTH_FAILED when the vault is not found', async () => {
    await useCase.storeBiometricPin('vault-1', '1234');
    mockRepo.findById.mockResolvedValue(success(null));
    const result = await useCase.execute('vault-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
  });

  it('returns AUTH_FAILED when the token is corrupted', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
    })));
    await storage.set('biometric_token_vault-1', 'garbage-not-a-valid-ciphertext');

    const result = await useCase.execute('vault-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
    expect(mockRepo.unlock).not.toHaveBeenCalled();
  });

  it('removes the biometric token', async () => {
    await useCase.storeBiometricPin('vault-1', '1234');
    await useCase.removeBiometricPin('vault-1');
    expect(await useCase.hasBiometricPin('vault-1')).toBe(false);
  }, 60000);

  it('returns AUTH_FAILED when the vault is locked out', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
      failedAttempts: 5,
      lockedUntil: Date.now() + 300000,
    })));
    await useCase.storeBiometricPin('vault-1', '1234');

    const result = await useCase.execute('vault-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
    expect(mockRepo.unlock).not.toHaveBeenCalled();
  });

  it('clears an expired lockout and unlocks via biometrics', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
      failedAttempts: 5,
      lockedUntil: Date.now() - 1000,
    })));
    await useCase.storeBiometricPin('vault-1', '1234');

    const result = await useCase.execute('vault-1');
    expect(result.success).toBe(true);
    expect(mockRepo.updateFields).toHaveBeenCalledWith('vault-1', {
      failedAttempts: 0,
      lockedUntil: null,
    });
    expect(mockRepo.unlock).toHaveBeenCalledWith('vault-1');
  });
});
