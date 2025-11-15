// lib/monitor.ts
import { metricsCollector } from './metrics';
import { geminiRequestQueue } from './request-queue';
import { alertService } from './alert-service';

export function startMonitoring() {
  setInterval(async () => {
    // 실제 수집된 메트릭 기반으로 알림 체크
    const queueStatus = geminiRequestQueue.getQueueStatus();
    await alertService.checkAndAlert(queueStatus.queueLength);

    // 실제 사용량 통계 로그 출력
    const recentMetrics = metricsCollector.getMetrics('hour');
    const summary = metricsCollector.getSummary();

    console.log('Monitoring (실제 사용량 기반):', {
      timestamp: new Date().toISOString(),
      // 실제 API 응답 값 기반 통계
      requestsPerMinute: summary.requestsPerMinute,
      tokensPerMinute: summary.tokensPerMinute,
      totalTokens: summary.totalTokens,
      totalCost: summary.totalCost,
      errorRate: summary.errorRate,
      // 큐 상태
      queueLength: queueStatus.queueLength,
      currentConcurrent: queueStatus.currentConcurrent,
    });
  }, 60000); // 1분마다 체크
}

// 서버 시작 시 모니터링 시작
if (typeof window === 'undefined') {
  startMonitoring();
}

