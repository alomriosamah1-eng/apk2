/** Configuration options for retry behaviour. */
export interface RetryOptions {
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Base delay in milliseconds before the first retry (doubles each attempt). */
  baseDelayMs: number;
  /** Maximum delay in milliseconds between retries. */
  maxDelayMs: number;
}

/** Executes an async function with exponential backoff retry logic. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 100, maxDelayMs = 3000 } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * delay * 0.1;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }
  throw lastError;
}


