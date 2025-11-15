// lib/slack-notifier.ts
import axios from 'axios';

interface SlackMessage {
  text?: string;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  attachments?: Array<{
    color?: string;
    title?: string;
    text?: string;
    fields?: Array<{
      title: string;
      value: string;
      short?: boolean;
    }>;
    footer?: string;
    ts?: number;
  }>;
}

class SlackNotifier {
  private webhookUrl?: string;
  private channel?: string;
  private username?: string;
  private iconEmoji?: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.channel = process.env.SLACK_CHANNEL;
    this.username = process.env.SLACK_USERNAME || 'chkAI Monitor';
    this.iconEmoji = process.env.SLACK_ICON_EMOJI || ':warning:';
  }

  /**
   * Incoming Webhooks를 사용한 메시지 전송
   */
  async sendWebhook(message: SlackMessage): Promise<boolean> {
    if (!this.webhookUrl) {
      console.warn('SLACK_WEBHOOK_URL이 설정되지 않았습니다.');
      return false;
    }

    try {
      const payload: SlackMessage = {
        ...message,
        channel: message.channel || this.channel,
        username: message.username || this.username,
        icon_emoji: message.icon_emoji || this.iconEmoji,
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      return response.status === 200;
    } catch (error) {
      console.error('슬랙 알림 전송 실패:', error);
      return false;
    }
  }

  /**
   * 알림 메시지 전송
   */
  async sendAlert(
    severity: 'warning' | 'critical' | 'info',
    title: string,
    details: {
      type: string;
      value: number;
      threshold: number;
      summary?: any;
    }
  ): Promise<boolean> {
    const colorMap = {
      warning: 'warning',  // 노란색
      critical: 'danger',   // 빨간색
      info: 'good',         // 파란색
    };

    const emojiMap = {
      warning: ':warning:',
      critical: ':rotating_light:',
      info: ':information_source:',
    };

    const attachment = {
      color: colorMap[severity],
      title: `${emojiMap[severity]} ${title}`,
      fields: [
        {
          title: '항목',
          value: details.type,
          short: true,
        },
        {
          title: '현재 값',
          value: details.value.toLocaleString(),
          short: true,
        },
        {
          title: '임계값',
          value: details.threshold.toLocaleString(),
          short: true,
        },
        {
          title: '초과율',
          value: `${((details.value / details.threshold) * 100).toFixed(1)}%`,
          short: true,
        },
      ],
      footer: 'chkAI Monitoring System',
      ts: Math.floor(Date.now() / 1000),
    };

    // 상세 정보 추가
    if (details.summary) {
      attachment.fields.push(
        {
          title: '최근 1분간 요청 수',
          value: `${details.summary.requestsPerMinute}건`,
          short: true,
        },
        {
          title: '최근 1분간 토큰 사용량',
          value: `${details.summary.tokensPerMinute.toLocaleString()} TPM`,
          short: true,
        },
        {
          title: '최근 1시간간 비용',
          value: `$${details.summary.hourlyCost?.toFixed(6) || details.summary.costPerHour?.toFixed(6) || '0.000000'}`,
          short: true,
        },
        {
          title: '에러율',
          value: `${(details.summary.errorRate * 100).toFixed(2)}%`,
          short: true,
        }
      );
    }

    return await this.sendWebhook({
      text: title,
      attachments: [attachment],
    });
  }
}

export const slackNotifier = new SlackNotifier();

