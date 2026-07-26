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

/** Current state of a circuit breaker. */
type CircuitState = 'closed' | 'open' | 'half-open';

/** Circuit breaker pattern implementation for preventing repeated failures. */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(threshold = 5, resetTimeoutMs = 30000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  /** Calls the provided async function, respecting the circuit breaker state. */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.threshold) {
        this.state = 'open';
      }
      throw error;
    }
  }

  /** Returns the current circuit breaker state. */
  getState(): string {
    return this.state;
  }

  /** Resets the circuit breaker to the closed state. */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
  }
}
