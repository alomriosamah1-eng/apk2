/** Returns the current timestamp in milliseconds. */
export function now(): number {
  return Date.now();
}

/** Returns the timestamp for the start of the current day (midnight). */
export function today(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Returns a timestamp `days` days in the past. */
export function daysAgo(days: number): number {
  return now() - days * 24 * 60 * 60 * 1000;
}

/** Converts a millisecond timestamp to an ISO 8601 string. */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toISOString();
}

/** Checks whether the given timestamp is older than `durationMs` from now. */
export function isExpired(timestamp: number, durationMs: number): boolean {
  return now() - timestamp > durationMs;
}
