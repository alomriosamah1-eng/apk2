import { Result, success, failure, AuthenticationError } from '@core/errors';
import * as Crypto from 'expo-crypto';

/** Result of an authentication attempt. */
export interface AuthResult {
  authenticated: boolean;
  method: 'pin' | 'biometric';
}

export class AuthenticateUseCase {
  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  async execute(
    pin: string,
    storedPinHash: string,
  ): Promise<Result<AuthResult>> {
    if (!pin || !storedPinHash) {
      return failure(new AuthenticationError('Invalid credentials'));
    }

    const pinHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin,
    );

    const isValid = this.constantTimeEqual(pinHash, storedPinHash);
    if (!isValid) {
      return failure(new AuthenticationError('Invalid PIN'));
    }

    return success({ authenticated: true, method: 'pin' });
  }
}
