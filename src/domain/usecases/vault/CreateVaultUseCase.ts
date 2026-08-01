import { Vault } from '@domain/entities/Vault';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { Result, failure, ValidationError } from '@core/errors';
import { generateId, now, generateSalt, hashPin } from '@core/utils';
import { validateVaultName, validatePin } from '@core/validators';
import { VaultType } from '@core/constants';
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';

export interface CreateVaultInput {
  name: string;
  type: VaultType;
  pin: string;
  icon?: string;
  color?: string;
}

export class CreateVaultUseCase {
  constructor(
    private vaultRepository: IVaultRepository,
    private biometricUnlockUseCase?: BiometricUnlockUseCase,
  ) {}

  async execute(input: CreateVaultInput): Promise<Result<Vault>> {
    const nameValidation = validateVaultName(input.name);
    if (!nameValidation.valid) {
      return failure(new ValidationError('name', nameValidation.error ?? 'Invalid name'));
    }

    const pinValidation = validatePin(input.pin);
    if (!pinValidation.valid) {
      return failure(new ValidationError('pin', pinValidation.error ?? 'Invalid PIN'));
    }

    const pinSalt = await generateSalt();
    const encryptedPinHash = await hashPin(input.pin, pinSalt);

    const timestamp = now();
    const vault: Vault = {
      id: generateId(),
      name: input.name.trim(),
      type: input.type,
      icon: input.icon ?? 'shield-lock',
      color: input.color ?? '#6C63FF',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastAccessedAt: timestamp,
      isLocked: false,
      encryptedPinHash,
      pinSalt,
      failedAttempts: 0,
      lockedUntil: null,
      itemCount: 0,
      totalSize: 0,
    };

    const result = await this.vaultRepository.create(vault);
    if (result.success && this.biometricUnlockUseCase) {
      await this.biometricUnlockUseCase.storeBiometricPin(vault.id, input.pin);
    }

    return result;
  }
}
