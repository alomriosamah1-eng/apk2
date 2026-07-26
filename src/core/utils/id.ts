import { v4 as uuidv4 } from 'uuid';

/** Generates a full UUID v4 identifier. */
export function generateId(): string {
  return uuidv4();
}

/** Generates a short identifier from the first segment of a UUID v4. */
export function generateShortId(): string {
  return uuidv4().split('-')[0] as string;
}

/** Checks whether a string is a valid UUID v4. */
export function isValidId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
