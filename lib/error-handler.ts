// lib/error-handler.ts
export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  retryAfter?: number;
}

export function classifyError(error: any): ErrorInfo {
  // Rate Limit (429)
  if (error.response?.status === 429) {
    const retryAfter = parseInt(
      error.response.headers['retry-after'] || '60',
      10
    );
    return {
      type: ErrorType.RATE_LIMIT,
      message: 'Rate limit exceeded',
      userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
      retryAfter,
    };
  }

  // Quota Exceeded (403)
  if (error.response?.status === 403) {
    return {
      type: ErrorType.QUOTA_EXCEEDED,
      message: 'Quota exceeded',
      userMessage: '일일 사용량 한도를 초과했습니다. 내일 다시 시도해주세요.',
      retryable: false,
    };
  }

  // Network Error
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network timeout',
      userMessage: '네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
    };
  }

  // API Error (5xx)
  if (error.response?.status >= 500) {
    return {
      type: ErrorType.API_ERROR,
      message: `API error: ${error.response.status}`,
      userMessage: '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
    };
  }

  // Validation Error (4xx)
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return {
      type: ErrorType.VALIDATION_ERROR,
      message: `Validation error: ${error.response.status}`,
      userMessage: '입력 정보를 확인해주세요.',
      retryable: false,
    };
  }

  // Unknown
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: error.message || 'Unknown error',
    userMessage: '예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.',
    retryable: false,
  };
}

