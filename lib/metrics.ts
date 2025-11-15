// lib/metrics.ts
interface APIMetrics {
  timestamp: Date;
  endpoint: string;
  requestId: string;
  inputTokens: number;        // 실제 API 응답의 promptTokenCount
  outputTokens: number;       // 실제 API 응답의 candidatesTokenCount
  totalTokens: number;       // 실제 API 응답의 totalTokenCount
  cachedTokens?: number;     // 실제 API 응답의 cachedContentTokenCount (선택적)
  cost: number;              // 실제 사용량 기반 계산된 비용
  duration: number;
  status: 'success' | 'error';
  errorCode?: string;
}

class MetricsCollector {
  private metrics: APIMetrics[] = [];
  private maxSize: number = 10000;

  record(metric: APIMetrics) {
    this.metrics.push(metric);
    
    // 크기 제한
    if (this.metrics.length > this.maxSize) {
      this.metrics.shift();
    }

    // 주기적으로 DB에 저장 (선택사항)
    if (this.metrics.length % 100 === 0) {
      this.flushToDatabase();
    }
  }

  getMetrics(timeRange: 'hour' | 'day' | 'week' = 'day') {
    const now = Date.now();
    const range = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    }[timeRange];

    return this.metrics.filter(
      (m) => now - m.timestamp.getTime() < range
    );
  }

  getSummary() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // 실제 수집된 메트릭 필터링
    const lastMinute = this.metrics.filter(m => m.timestamp.getTime() >= oneMinuteAgo);
    const lastHour = this.metrics.filter(m => m.timestamp.getTime() >= oneHourAgo);
    const lastDay = this.metrics.filter(m => m.timestamp.getTime() >= oneDayAgo);

    const successfulLastMinute = lastMinute.filter(m => m.status === 'success');
    const successfulLastHour = lastHour.filter(m => m.status === 'success');
    const successfulLastDay = lastDay.filter(m => m.status === 'success');

    // 실제 API 응답 값 기반 계산
    return {
      // 최근 1분간 실제 사용량
      requestsPerMinute: lastMinute.length,  // 실제 1분간 요청 수
      tokensPerMinute: lastMinute.reduce((sum, m) => sum + m.totalTokens, 0),  // 실제 1분간 토큰 사용량
      
      // 최근 1시간간 실제 사용량
      requestsPerHour: lastHour.length,
      tokensPerHour: lastHour.reduce((sum, m) => sum + m.totalTokens, 0),
      costPerHour: lastHour.reduce((sum, m) => sum + m.cost, 0),
      
      // 최근 1일간 실제 사용량
      totalRequests: lastDay.length,
      successfulRequests: successfulLastDay.length,
      failedRequests: lastDay.length - successfulLastDay.length,
      errorRate: lastDay.length > 0 ? (lastDay.length - successfulLastDay.length) / lastDay.length : 0,
      
      // 실제 토큰 사용량 합계 (API 응답의 totalTokenCount 합계)
      totalTokens: lastDay.reduce((sum, m) => sum + m.totalTokens, 0),
      totalInputTokens: lastDay.reduce((sum, m) => sum + m.inputTokens, 0),
      totalOutputTokens: lastDay.reduce((sum, m) => sum + m.outputTokens, 0),
      totalCachedTokens: lastDay.reduce((sum, m) => sum + (m.cachedTokens || 0), 0),
      
      // 실제 비용 합계 (실제 사용량 기반 계산)
      totalCost: lastDay.reduce((sum, m) => sum + m.cost, 0),
      
      // 평균 응답 시간 (성공한 요청만)
      avgDuration: successfulLastDay.length > 0
        ? successfulLastDay.reduce((sum, m) => sum + m.duration, 0) / successfulLastDay.length
        : 0,
    };
  }

  private async flushToDatabase() {
    // MongoDB에 저장하는 로직 (선택사항)
    // TODO: 필요시 구현
  }

  clear() {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

