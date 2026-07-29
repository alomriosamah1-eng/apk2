import { CreateVaultUseCase } from '@domain/usecases/vault/CreateVaultUseCase';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { VaultType } from '@core/constants';
import { success, ValidationError } from '@core/errors';

jest.mock('expo-crypto');

describe('CreateVaultUseCase', () => {
  const mockRepo: jest.Mocked<IVaultRepository> = {
    create: jest.fn().mockImplementation(async (vault) => success(vault)),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateLastAccessed: jest.fn(),
    lock: jest.fn(),
    unlock: jest.fn(),
    count: jest.fn(),
  };

  const useCase = new CreateVaultUseCase(mockRepo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates vault with valid input', async () => {
    const result = await useCase.execute({
      name: 'My Vault',
      type: VaultType.PERSONAL,
      pin: '1234',
    });
    expect(result.success).toBe(true);
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    if (result.success) {
      expect(result.data.name).toBe('My Vault');
    }
  });

  it('rejects empty name', async () => {
    const result = await useCase.execute({
      name: '',
      type: VaultType.PERSONAL,
      pin: '1234',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  }, 10000);

  it('rejects short PIN', async () => {
    const result = await useCase.execute({
      name: 'Test',
      type: VaultType.PERSONAL,
      pin: '12',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});
