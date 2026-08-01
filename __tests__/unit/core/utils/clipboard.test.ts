import { scheduleClipboardClear } from '@core/utils/clipboard';

describe('scheduleClipboardClear', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears the clipboard after the configured delay when enabled', () => {
    const setClipboardValue = jest.fn();
    scheduleClipboardClear(setClipboardValue, true, 10000);

    expect(setClipboardValue).not.toHaveBeenCalled();
    jest.advanceTimersByTime(9999);
    expect(setClipboardValue).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(setClipboardValue).toHaveBeenCalledWith('');
  });

  it('does not clear the clipboard when disabled', () => {
    const setClipboardValue = jest.fn();
    scheduleClipboardClear(setClipboardValue, false, 10000);
    jest.advanceTimersByTime(20000);
    expect(setClipboardValue).not.toHaveBeenCalled();
  });

  it('returns a cleanup that cancels a pending clear', () => {
    const setClipboardValue = jest.fn();
    const cleanup = scheduleClipboardClear(setClipboardValue, true, 10000);
    cleanup();
    jest.advanceTimersByTime(20000);
    expect(setClipboardValue).not.toHaveBeenCalled();
  });

  it('is a no-op for non-positive delays', () => {
    const setClipboardValue = jest.fn();
    scheduleClipboardClear(setClipboardValue, true, 0);
    jest.advanceTimersByTime(5000);
    expect(setClipboardValue).not.toHaveBeenCalled();
  });
});
