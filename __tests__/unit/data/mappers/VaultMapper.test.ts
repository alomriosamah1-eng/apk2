import { VaultMapper } from '@data/mappers/VaultMapper';
import { Vault } from '@domain/entities/Vault';
import { VaultType } from '@core/constants';

describe('VaultMapper', () => {
  const mapper = new VaultMapper();

  const testEntity: Vault = {
    id: 'test-id',
    name: 'Test Vault',
    type: VaultType.PERSONAL,
    icon: 'shield-lock',
    color: '#6C63FF',
    createdAt: 1000,
    updatedAt: 2000,
    lastAccessedAt: 1500,
    isLocked: false,
    encryptedPinHash: 'abc123',
    pinSalt: 'def456',
    failedAttempts: 0,
    lockedUntil: null,
    itemCount: 5,
    totalSize: 1000,
    backupVersion: 1,
  };

  it('maps entity to DTO and back', () => {
    const dto = mapper.toDTO(testEntity);
    expect(dto.id).toBe('test-id');
    expect(dto.is_locked).toBe(0);

    const entity = mapper.toEntity(dto);
    expect(entity.id).toBe(testEntity.id);
    expect(entity.name).toBe(testEntity.name);
    expect(entity.isLocked).toBe(false);
    expect(entity.type).toBe(VaultType.PERSONAL);
  });

  it('converts isLocked boolean to/from integer correctly', () => {
    const locked = { ...testEntity, isLocked: true };
    const dto = mapper.toDTO(locked);
    expect(dto.is_locked).toBe(1);

    const entity = mapper.toEntity(dto);
    expect(entity.isLocked).toBe(true);
  });
});
