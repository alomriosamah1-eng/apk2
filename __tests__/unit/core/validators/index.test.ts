import { validatePin, validateVaultName } from '@core/validators';

describe('validatePin', () => {
  it('accepts 4-digit PIN', () => {
    expect(validatePin('1234').valid).toBe(true);
  });

  it('accepts 8-digit PIN', () => {
    expect(validatePin('12345678').valid).toBe(true);
  });

  it('rejects PIN shorter than 4 digits', () => {
    expect(validatePin('123').valid).toBe(false);
  });

  it('rejects PIN longer than 8 digits', () => {
    expect(validatePin('123456789').valid).toBe(false);
  });

  it('rejects PIN with non-digit characters', () => {
    expect(validatePin('12a4').valid).toBe(false);
  });

  it('rejects empty PIN', () => {
    expect(validatePin('').valid).toBe(false);
  });
});

describe('validateVaultName', () => {
  it('accepts valid Arabic name', () => {
    expect(validateVaultName('خزنتي').valid).toBe(true);
  });

  it('accepts valid English name', () => {
    expect(validateVaultName('My Vault').valid).toBe(true);
  });

  it('rejects empty name', () => {
    expect(validateVaultName('').valid).toBe(false);
  });

  it('rejects name longer than 50 characters', () => {
    expect(validateVaultName('a'.repeat(51)).valid).toBe(false);
  });
});
