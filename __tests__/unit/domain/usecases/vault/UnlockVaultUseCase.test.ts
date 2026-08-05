import { UnlockVaultUseCase } from '@domain/usecases/vault/UnlockVaultUseCase';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Vault } from '@domain/entities/Vault';
import { VaultType } from '@core/constants';
import { success, AuthenticationError } from '@core/errors';
import { generateSalt, hashPin } from '@core/utils';

jest.mock('expo-crypto');

// Real PBKDF2 hashing (30k–100k iterations) is intentionally slow; allow time.
jest.setTimeout(30000);

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

describe('UnlockVaultUseCase', () => {
  let mockRepo: jest.Mocked<IVaultRepository>;
  let useCase: UnlockVaultUseCase;

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
    useCase = new UnlockVaultUseCase(mockRepo);
  });

  it('unlocks a vault with the correct PIN', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
    })));

    const result = await useCase.execute('vault-1', '1234');
    expect(result.success).toBe(true);
    expect(mockRepo.unlock).toHaveBeenCalledWith('vault-1');
  });

  it('rejects an incorrect PIN and increments failedAttempts', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
    })));

    const result = await useCase.execute('vault-1', '9999');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
    expect(mockRepo.updateFields).toHaveBeenCalledWith('vault-1', {
      failedAttempts: 1,
      lockedUntil: null,
    });
  });

  it('locks the vault after MAX_ATTEMPTS and rejects while locked', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
      failedAttempts: 4,
    })));

    await useCase.execute('vault-1', '9999');

    const lockedUntil = (mockRepo.updateFields.mock.calls[0]![1] as { lockedUntil: number }).lockedUntil;
    expect(lockedUntil).toBeGreaterThan(now);

    mockRepo.findById.mockResolvedValue(success(makeVault({
      encryptedPinHash: pinHash,
      pinSalt: salt,
      failedAttempts: 5,
      lockedUntil: lockedUntil,
    })));

    const result = await useCase.execute('vault-1', '1234');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
    expect(mockRepo.unlock).not.toHaveBeenCalled();
  });

  it('returns AUTH_FAILED when the vault does not exist', async () => {
    mockRepo.findById.mockResolvedValue(success(null));
    const result = await useCase.execute('missing', '1234');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
  }, 60000);
});
