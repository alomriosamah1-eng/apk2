import { z } from 'zod';

/** Zod schema for PIN validation (4-8 digits). */
export const pinSchema = z
  .string()
  .min(4, 'PIN must be at least 4 digits')
  .max(8, 'PIN must be at most 8 digits')
  .regex(/^\d+$/, 'PIN must contain only digits');

/** Zod schema for password validation (8-128 characters). */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

/** Zod schema for vault name validation (1-50 chars, alphanumeric with spaces/hyphens/underscores). */
export const vaultNameSchema = z
  .string()
  .min(1, 'Vault name is required')
  .max(50, 'Vault name must be at most 50 characters')
  .regex(/^[\u0600-\u06FFa-zA-Z0-9\s\-_]+$/, 'Vault name can only contain letters, numbers, spaces, hyphens, and underscores');

/** Optional email address validation schema. */
export const emailSchema = z.string().email('Invalid email address').optional();

/** Optional URL validation schema. */
export const urlSchema = z.string().url('Invalid URL').optional();

/** Zod schema for note title validation (1-100 characters). */
export const noteTitleSchema = z
  .string()
  .min(1, 'Note title is required')
  .max(100, 'Note title must be at most 100 characters');

/** Zod schema for service name validation (1-100 characters). */
export const serviceNameSchema = z
  .string()
  .min(1, 'Service name is required')
  .max(100, 'Service name must be at most 100 characters');

/** Optional username validation schema (max 100 characters). */
export const usernameSchema = z.string().max(100).optional();

/** Validates a PIN string against the pin schema. */
export function validatePin(pin: string): { valid: boolean; error?: string } {
  const result = pinSchema.safeParse(pin);
  return result.success ? { valid: true } : { valid: false, error: result.error.errors[0]?.message };
}

/** Validates a password string against the password schema. */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  const result = passwordSchema.safeParse(password);
  return result.success ? { valid: true } : { valid: false, error: result.error.errors[0]?.message };
}

/** Validates a vault name against the vault name schema. */
export function validateVaultName(name: string): { valid: boolean; error?: string } {
  const result = vaultNameSchema.safeParse(name);
  return result.success ? { valid: true } : { valid: false, error: result.error.errors[0]?.message };
}
