/**
 * Clipboard protection helper (Recovery/17 P5.7).
 * When enabled, schedules a one-shot clipboard clear after the configured delay.
 * Returns a cleanup function that cancels any pending clear.
 */
export function scheduleClipboardClear(
  setClipboardValue: (value: string) => void,
  enabled: boolean,
  delayMs: number,
): () => void {
  if (!enabled || delayMs <= 0) return () => {};
  const timer = setTimeout(() => {
    setClipboardValue('');
  }, delayMs);
  return () => {
    clearTimeout(timer);
  };
}
