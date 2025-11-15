// lib/retry-utils.ts
interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: number[];
}

class RetryHandler {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [429, 500, 502, 503, 504],
      ...options,
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // 재시도 불가능한 에러
        if (!this.isRetryable(error)) {
          throw error;
        }

        // 마지막 시도면 에러 throw
        if (attempt >= this.options.maxRetries) {
          break;
        }

        // 재시도 콜백
        if (onRetry) {
          onRetry(attempt + 1, error as Error);
        }

        // Exponential Backoff
        const delay = Math.min(
          this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt),
          this.options.maxDelay
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Unknown error');
  }

  private isRetryable(error: any): boolean {
    // HTTP 에러 코드 확인
    if (error.response?.status) {
      return this.options.retryableErrors.includes(error.response.status);
    }

    // 네트워크 에러는 재시도 가능
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }
}

export const retryHandler = new RetryHandler({
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 10000,
  backoffMultiplier: 2,
});

