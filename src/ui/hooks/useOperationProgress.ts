import { useCallback, useRef, useState } from 'react';
import { ImportProgressUpdate } from '@data/media/MediaStorage';

export interface OperationProgressApi {
  /** The current live progress update, or null when idle. */
  progress: ImportProgressUpdate | null;
  /** Starts a new operation (resets the cancel flag and shows a Waiting state). */
  begin: (total: number) => void;
  /** Feeds the next live progress update into the UI. */
  update: (u: ImportProgressUpdate) => void;
  /** Hides the progress overlay. */
  finish: () => void;
  /** Requests cancellation (cooperative). */
  cancel: () => void;
  /** Whether cancellation was requested. */
  isCancelled: () => boolean;
}

/**
 * Holds the live state of a long-running operation (import/export/extract) and
 * exposes a cooperative cancellation flag. The value refreshes via the
 * `update` callback thrown by the worker engine, so the UI stays reactive.
 */
export function useOperationProgress(): OperationProgressApi {
  const [progress, setProgress] = useState<ImportProgressUpdate | null>(null);
  const cancelRef = useRef(false);

  const begin = useCallback((total: number) => {
    cancelRef.current = false;
    setProgress({
      phase: 'waiting',
      done: 0,
      total,
      currentName: null,
      bytesProcessed: 0,
      elapsedMs: 0,
      speedBytesPerSec: 0,
    });
  }, []);

  const update = useCallback((u: ImportProgressUpdate) => setProgress(u), []);
  const finish = useCallback(() => setProgress(null), []);
  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);
  const isCancelled = useCallback(() => cancelRef.current, []);

  return { progress, begin, update, finish, cancel, isCancelled };
}