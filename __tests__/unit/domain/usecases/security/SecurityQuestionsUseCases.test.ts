import { SetupSecurityQuestionsUseCase } from '@domain/usecases/security/SetupSecurityQuestionsUseCase';
import { VerifySecurityAnswersUseCase } from '@domain/usecases/security/VerifySecurityAnswersUseCase';
import { ResetPinWithSecurityQuestionsUseCase } from '@domain/usecases/security/ResetPinWithSecurityQuestionsUseCase';
import { hashAnswer } from '@domain/usecases/security/securityAnswers';
import { IVaultRepository } from '@domain/repositories/IVaultRepository';
import { ISecurityQuestionRepository } from '@domain/repositories/ISecurityQuestionRepository';
import { SecurityQuestion } from '@domain/entities/SecurityQuestion';
import { Vault } from '@domain/entities/Vault';
import { VaultType } from '@core/constants';
import { success, AuthenticationError, ValidationError } from '@core/errors';
import { generateSalt, hashPin } from '@core/utils';

jest.mock('expo-crypto');
jest.setTimeout(60000);

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
    isLocked: false,
    encryptedPinHash: '',
    pinSalt: '',
    failedAttempts: 0,
    lockedUntil: null,
    itemCount: 0,
    totalSize: 0,
    ...overrides,
  };
}

function makeVaultRepo(): jest.Mocked<IVaultRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn().mockImplementation(async (v: Vault) => success(v)),
    delete: jest.fn(),
    updateLastAccessed: jest.fn(),
    lock: jest.fn(),
    unlock: jest.fn().mockImplementation(async () => success(undefined)),
    updateFields: jest.fn(),
    count: jest.fn(),
  };
}

function makeQuestionRepo(): jest.Mocked<ISecurityQuestionRepository> {
  return {
    findByVaultId: jest.fn(),
    replaceForVault: jest.fn().mockImplementation(async () => success(undefined)),
  };
}

describe('SetupSecurityQuestionsUseCase', () => {
  it('saves security questions after verifying the current PIN', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    const repo = makeVaultRepo();
    repo.findById.mockResolvedValue(success(makeVault({ encryptedPinHash: pinHash, pinSalt: salt })));
    const questionRepo = makeQuestionRepo();
    const useCase = new SetupSecurityQuestionsUseCase(repo, questionRepo);

    const result = await useCase.execute('vault-1', '1234', [
      { question: 'motherName', answer: 'Aliaa' },
      { question: 'petName', answer: 'Rex' },
    ]);

    expect(result.success).toBe(true);
    expect(questionRepo.replaceForVault).toHaveBeenCalledTimes(1);
    const saved = (questionRepo.replaceForVault.mock.calls[0]![1] as SecurityQuestion[]);
    expect(saved.length).toBe(2);
    // Answers are hashed, never stored in plaintext.
    expect(saved[0]!.answerHash).not.toContain('Aliaa');
    expect(saved[0]!.answerSalt).toBeDefined();
    expect(saved[0]!.vaultId).toBe('vault-1');
  }, 60000);

  it('rejects an incorrect current PIN', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    const repo = makeVaultRepo();
    repo.findById.mockResolvedValue(success(makeVault({ encryptedPinHash: pinHash, pinSalt: salt })));
    const useCase = new SetupSecurityQuestionsUseCase(repo, makeQuestionRepo());

    const result = await useCase.execute('vault-1', '9999', [
      { question: 'motherName', answer: 'Aliaa' },
      { question: 'petName', answer: 'Rex' },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeInstanceOf(AuthenticationError);
  });

  it('rejects fewer than the minimum number of questions', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    const repo = makeVaultRepo();
    repo.findById.mockResolvedValue(success(makeVault({ encryptedPinHash: pinHash, pinSalt: salt })));
    const useCase = new SetupSecurityQuestionsUseCase(repo, makeQuestionRepo());

    const result = await useCase.execute('vault-1', '1234', [
      { question: 'motherName', answer: 'Aliaa' },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeInstanceOf(ValidationError);
  });

  it('rejects answers that are too short', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    const repo = makeVaultRepo();
    repo.findById.mockResolvedValue(success(makeVault({ encryptedPinHash: pinHash, pinSalt: salt })));
    const useCase = new SetupSecurityQuestionsUseCase(repo, makeQuestionRepo());

    const result = await useCase.execute('vault-1', '1234', [
      { question: 'motherName', answer: 'a' },
      { question: 'petName', answer: 'b' },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeInstanceOf(ValidationError);
  });
});

async function storedQuestions(answers: string[]): Promise<SecurityQuestion[]> {
  const out: SecurityQuestion[] = [];
  for (let i = 0; i < answers.length; i++) {
    const { salt, hash } = await hashAnswer(answers[i]!);
    out.push({
      id: `q-${i}`,
      vaultId: 'vault-1',
      question: `preset${i}`,
      answerHash: hash,
      answerSalt: salt,
      position: i,
      createdAt: now,
      updatedAt: now,
    });
  }
  return out;
}

describe('VerifySecurityAnswersUseCase', () => {
  it('verifies correct answers (case/whitespace insensitive)', async () => {
    const repo = makeQuestionRepo();
    repo.findByVaultId.mockResolvedValue(success(await storedQuestions(['Aliaa', 'Rex'])));
    const useCase = new VerifySecurityAnswersUseCase(repo);

    const result = await useCase.execute('vault-1', ['  aliaa ', 'rex']);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(true);
      expect(result.data.failedIndexes).toHaveLength(0);
    }
  });

  it('reports failed indexes for wrong answers', async () => {
    const repo = makeQuestionRepo();
    repo.findByVaultId.mockResolvedValue(success(await storedQuestions(['Aliaa', 'Rex'])));
    const useCase = new VerifySecurityAnswersUseCase(repo);

    const result = await useCase.execute('vault-1', ['Aliaa', 'Wrong']);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(false);
      expect(result.data.failedIndexes).toEqual([1]);
    }
  });

  it('fails with AUTH_FAILED when no questions are configured', async () => {
    const repo = makeQuestionRepo();
    repo.findByVaultId.mockResolvedValue(success([]));
    const useCase = new VerifySecurityAnswersUseCase(repo);

    const result = await useCase.execute('vault-1', ['a', 'b']);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeInstanceOf(AuthenticationError);
  });
});

describe('ResetPinWithSecurityQuestionsUseCase', () => {
  it('resets the PIN and unlocks the vault when answers are correct', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    const vaultRepo = makeVaultRepo();
    vaultRepo.findById.mockResolvedValue(success(makeVault({ encryptedPinHash: pinHash, pinSalt: salt })));
    const questionRepo = makeQuestionRepo();
    questionRepo.findByVaultId.mockResolvedValue(success(await storedQuestions(['Aliaa', 'Rex'])));
    const useCase = new ResetPinWithSecurityQuestionsUseCase(vaultRepo, questionRepo);

    const result = await useCase.execute('vault-1', ['Aliaa', 'Rex'], '9876');
    expect(result.success).toBe(true);

    expect(vaultRepo.update).toHaveBeenCalledTimes(1);
    const updated = (vaultRepo.update.mock.calls[0]![0] as Vault);
    expect(updated.encryptedPinHash).not.toBe(pinHash);
    expect(updated.failedAttempts).toBe(0);
    expect(updated.lockedUntil).toBeNull();
    expect(vaultRepo.unlock).toHaveBeenCalledWith('vault-1');
  }, 60000);

  it('does not reset the PIN when answers are wrong', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    const vaultRepo = makeVaultRepo();
    vaultRepo.findById.mockResolvedValue(success(makeVault({ encryptedPinHash: pinHash, pinSalt: salt })));
    const questionRepo = makeQuestionRepo();
    questionRepo.findByVaultId.mockResolvedValue(success(await storedQuestions(['Aliaa', 'Rex'])));
    const useCase = new ResetPinWithSecurityQuestionsUseCase(vaultRepo, questionRepo);

    const result = await useCase.execute('vault-1', ['Aliaa', 'Wrong'], '9876');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeInstanceOf(AuthenticationError);
    expect(vaultRepo.update).not.toHaveBeenCalled();
    expect(vaultRepo.unlock).not.toHaveBeenCalled();
  });

  it('rejects an invalid new PIN', async () => {
    const salt = await generateSalt();
    const pinHash = await hashPin('1234', salt);
    const vaultRepo = makeVaultRepo();
    vaultRepo.findById.mockResolvedValue(success(makeVault({ encryptedPinHash: pinHash, pinSalt: salt })));
    const questionRepo = makeQuestionRepo();
    questionRepo.findByVaultId.mockResolvedValue(success(await storedQuestions(['Aliaa', 'Rex'])));
    const useCase = new ResetPinWithSecurityQuestionsUseCase(vaultRepo, questionRepo);

    const result = await useCase.execute('vault-1', ['Aliaa', 'Rex'], '12');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeInstanceOf(ValidationError);
  });
});