import { generateSalt, hashPin, verifyPin } from '@core/utils';

/**
 * Normalizes a security answer so that comparisons are case- and
 * whitespace-insensitive (e.g. "  Aliaa  " and "aliaa" are treated as equal).
 */
export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Hashes a security answer with PBKDF2 and a fresh salt. */
export async function hashAnswer(
  answer: string,
  salt?: string,
): Promise<{ salt: string; hash: string }> {
  const normalized = normalizeAnswer(answer);
  const s = salt ?? (await generateSalt());
  const hash = await hashPin(normalized, s);
  return { salt: s, hash };
}

/** Verifies a candidate answer against a stored hashed answer. */
export async function verifyAnswer(
  answer: string,
  salt: string,
  storedHash: string,
): Promise<boolean> {
  const verification = await verifyPin(normalizeAnswer(answer), salt, storedHash);
  return verification.verified;
}