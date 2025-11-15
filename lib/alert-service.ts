// lib/alert-service.ts
import { metricsCollector } from './metrics';
import { slackNotifier } from './slack-notifier';

interface AlertThreshold {
  type: 'rpm' | 'tpm' | 'cost' | 'errorRate' | 'queueLength';
  threshold: number;
  severity: 'warning' | 'critical';
}

interface APIMetrics {
  timestamp: Date;
  endpoint: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  cost: number;
  duration: number;
  status: 'success' | 'error';
  errorCode?: string;
}

class AlertService {
  private thresholds: AlertThreshold[] = [
    // 무료 플랜 기준 (15 RPM, 1,000,000 TPM)
    { type: 'rpm', threshold: 10, severity: 'warning' },        // 15의 67%
    { type: 'rpm', threshold: 14, severity: 'critical' },        // 15의 93%
    { type: 'tpm', threshold: 800000, severity: 'warning' },     // 1,000,000의 80%
    { type: 'tpm', threshold: 950000, severity: 'critical' },     // 1,000,000의 95%
    { type: 'errorRate', threshold: 0.1, severity: 'warning' },  // 10%
    { type: 'errorRate', threshold: 0.2, severity: 'critical' }, // 20%
    { type: 'queueLength', threshold: 50, severity: 'warning' },
    { type: 'queueLength', threshold: 100, severity: 'critical' },
  ];

  private alertHistory: Map<string, number> = new Map();
  private cooldownPeriod = 5 * 60 * 1000; // 5분

  /**
   * 실제 수집된 메트릭을 기반으로 알림 체크
   */
  async checkAndAlert(queueLength?: number) {
    if (process.env.ALERTS_ENABLED !== 'true') {
      return;
    }

    // 실제 수집된 메트릭 가져오기
    const recentMetrics = metricsCollector.getMetrics('hour'); // 최근 1시간
    const summary = this.calculateRealTimeMetrics(recentMetrics, queueLength);

    for (const threshold of this.thresholds) {
      const value = this.getValue(summary, threshold.type);
      const alertKey = `${threshold.type}-${threshold.severity}`;

      if (value >= threshold.threshold) {
        // 쿨다운 체크
        const lastAlert = this.alertHistory.get(alertKey) || 0;
        if (Date.now() - lastAlert < this.cooldownPeriod) {
          continue; // 쿨다운 중
        }

        await this.sendAlert(threshold, value, summary);
        this.alertHistory.set(alertKey, Date.now());
      }
    }
  }

  /**
   * 실제 수집된 메트릭으로부터 실시간 통계 계산
   */
  private calculateRealTimeMetrics(metrics: APIMetrics[], queueLength?: number) {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    // 최근 1분간 메트릭
    const lastMinute = metrics.filter(m => m.timestamp.getTime() >= oneMinuteAgo);
    // 최근 1시간간 메트릭
    const lastHour = metrics.filter(m => m.timestamp.getTime() >= oneHourAgo);

    // 실제 API 응답 값 기반 계산
    const successful = lastHour.filter(m => m.status === 'success');
    const failed = lastHour.filter(m => m.status === 'error');

    // 실제 토큰 사용량 합계 (API 응답의 totalTokenCount 합계)
    const totalTokensLastMinute = lastMinute.reduce(
      (sum, m) => sum + m.totalTokens, 0
    );
    const totalTokensLastHour = lastHour.reduce(
      (sum, m) => sum + m.totalTokens, 0
    );

    // 실제 비용 합계 (실제 사용량 기반 계산된 cost 합계)
    const totalCostLastHour = lastHour.reduce(
      (sum, m) => sum + m.cost, 0
    );

    return {
      // 실제 RPM (최근 1분간 요청 수)
      requestsPerMinute: lastMinute.length,
      
      // 실제 TPM (최근 1분간 실제 API 응답의 totalTokenCount 합계)
      tokensPerMinute: totalTokensLastMinute,
      
      // 실제 시간당 토큰 사용량
      tokensPerHour: totalTokensLastHour,
      
      // 실제 비용 (실제 사용량 기반)
      hourlyCost: totalCostLastHour,
      costPerHour: totalCostLastHour,
      
      // 실제 에러율
      errorRate: lastHour.length > 0 ? failed.length / lastHour.length : 0,
      
      // 총 요청 수
      totalRequests: lastHour.length,
      
      // 성공 요청 수
      successfulRequests: successful.length,

      // 큐 길이
      queueLength: queueLength || 0,
    };
  }

  private getValue(summary: any, type: string): number {
    switch (type) {
      case 'rpm':
        return summary.requestsPerMinute || 0;  // 실제 1분간 요청 수
      case 'tpm':
        return summary.tokensPerMinute || 0;    // 실제 1분간 토큰 사용량
      case 'cost':
        return summary.hourlyCost || summary.costPerHour || 0;         // 실제 시간당 비용
      case 'errorRate':
        return summary.errorRate || 0;           // 실제 에러율
      case 'queueLength':
        return summary.queueLength || 0;        // 큐 길이
      default:
        return 0;
    }
  }

  private async sendAlert(
    threshold: AlertThreshold,
    value: number,
    summary: any
  ) {
    const typeNames = {
      rpm: '분당 요청 수 (RPM)',
      tpm: '분당 토큰 수 (TPM)',
      cost: '시간당 비용',
      errorRate: '에러율',
      queueLength: '큐 대기 길이',
    };

    const message = `${typeNames[threshold.type]}이(가) 임계값(${threshold.threshold})을 초과했습니다.`;

    // 슬랙 알림 전송
    if (process.env.ALERTS_ENABLED === 'true') {
      await slackNotifier.sendAlert(
        threshold.severity,
        message,
        {
          type: threshold.type,
          value,
          threshold: threshold.threshold,
          summary,
        }
      );
    }

    // 로그 기록
    console.error(`[ALERT] ${threshold.severity.toUpperCase()}:`, {
      type: threshold.type,
      value,
      threshold: threshold.threshold,
      summary,
    });
  }
}

export const alertService = new AlertService();

