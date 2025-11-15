# 슬랙 알림 연동 가이드

## 📋 목차

1. [슬랙 웹훅 설정](#슬랙-웹훅-설정)
2. [필요한 정보](#필요한-정보)
3. [환경 변수 설정](#환경-변수-설정)
4. [구현 방법](#구현-방법)
5. [메시지 포맷](#메시지-포맷)

---

## 🔗 슬랙 웹훅 설정

### 방법 1: Incoming Webhooks (간단)

1. **Slack 워크스페이스 접속**
   - https://your-workspace.slack.com 접속

2. **앱 생성**
   - https://api.slack.com/apps 접속
   - "Create New App" 클릭
   - "From scratch" 선택
   - App 이름: `chkAI Monitor`
   - 워크스페이스 선택

3. **Incoming Webhooks 활성화**
   - 좌측 메뉴에서 "Incoming Webhooks" 클릭
   - "Activate Incoming Webhooks" 토글 ON

4. **웹훅 URL 생성**
   - "Add New Webhook to Workspace" 클릭
   - 알림을 받을 채널 선택 (예: `#api-monitoring`)
   - "Allow" 클릭
   - 생성된 Webhook URL 복사

5. **웹훅 URL 형식**
   - Slack에서 생성된 웹훅 URL을 복사하세요
   - 형식: `https://hooks.slack.com/services/...` (실제 URL은 Slack에서 제공)

### 방법 2: Slack App (고급)

1. **Slack App 생성** (위와 동일)

2. **OAuth & Permissions 설정**
   - 좌측 메뉴에서 "OAuth & Permissions" 클릭
   - Scopes > Bot Token Scopes에 다음 추가:
     - `chat:write` - 메시지 전송
     - `chat:write.public` - 공개 채널에 메시지 전송

3. **앱 설치**
   - "Install to Workspace" 클릭
   - 권한 승인

4. **Bot Token 사용**
   - OAuth & Permissions 페이지에서 "Bot User OAuth Token" 복사
   - 형식: `xoxb-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx`

---

## 📝 필요한 정보

### Incoming Webhooks 사용 시

| 항목 | 설명 | 예시 |
|------|------|------|
| **Webhook URL** | 슬랙에서 제공하는 웹훅 URL | `https://hooks.slack.com/services/...` |
| **채널** | 알림을 받을 채널 이름 | `#api-monitoring` |
| **사용자명** | 봇 이름 (선택적) | `chkAI Monitor` |
| **아이콘** | 이모지 또는 이미지 URL (선택적) | `:warning:` |

### Slack App 사용 시

| 항목 | 설명 | 예시 |
|------|------|------|
| **Bot Token** | OAuth Bot Token | `xoxb-xxxxxxxxxxxx-...` |
| **채널 ID** | 알림을 받을 채널 ID | `C0123456789` |
| **사용자명** | 봇 이름 (선택적) | `chkAI Monitor` |

---

## 🔧 환경 변수 설정

### Incoming Webhooks 사용

```env
# 슬랙 알림 설정
# SLACK_WEBHOOK_URL은 Slack에서 생성한 웹훅 URL을 입력하세요
SLACK_WEBHOOK_URL=your-slack-webhook-url-here
SLACK_CHANNEL=#notification
SLACK_USERNAME=chkAI Monitor
SLACK_ICON_EMOJI=:warning:
```

### Slack App 사용

```env
# 슬랙 알림 설정
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
SLACK_CHANNEL_ID=C0123456789
SLACK_USERNAME=chkAI Monitor
```

### 공통 설정

```env
# 알림 설정
ALERTS_ENABLED=true
ALERT_COOLDOWN_MINUTES=5
ALERT_RPM_WARNING=10
ALERT_RPM_CRITICAL=14
ALERT_TPM_WARNING=800000
ALERT_TPM_CRITICAL=950000
```

---

## 💻 구현 방법

### `/lib/slack-notifier.ts`

```typescript
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
  private botToken?: string;
  private channel?: string;
  private channelId?: string;
  private username?: string;
  private iconEmoji?: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.channel = process.env.SLACK_CHANNEL;
    this.channelId = process.env.SLACK_CHANNEL_ID;
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
   * Slack App API를 사용한 메시지 전송
   */
  async sendMessage(text: string, attachments?: any[]): Promise<boolean> {
    if (!this.botToken || !this.channelId) {
      console.warn('SLACK_BOT_TOKEN 또는 SLACK_CHANNEL_ID가 설정되지 않았습니다.');
      return false;
    }

    try {
      const response = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: this.channelId,
          text,
          attachments,
          username: this.username,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.botToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      return response.data.ok === true;
    } catch (error) {
      console.error('슬랙 메시지 전송 실패:', error);
      return false;
    }
  }

  /**
   * 알림 메시지 전송 (자동으로 방법 선택)
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
          value: `$${details.summary.hourlyCost.toFixed(6)}`,
          short: true,
        },
        {
          title: '에러율',
          value: `${(details.summary.errorRate * 100).toFixed(2)}%`,
          short: true,
        }
      );
    }

    // Webhook URL이 있으면 Webhook 사용, 없으면 Bot Token 사용
    if (this.webhookUrl) {
      return await this.sendWebhook({
        text: title,
        attachments: [attachment],
      });
    } else if (this.botToken) {
      return await this.sendMessage(title, [attachment]);
    }

    return false;
  }
}

export const slackNotifier = new SlackNotifier();
```

### `/lib/alert-service.ts` 수정

```typescript
// lib/alert-service.ts (슬랙 연동 추가)
import { slackNotifier } from './slack-notifier';

class AlertService {
  // ... 기존 코드 ...

  private async sendAlert(
    threshold: AlertThreshold,
    value: number,
    summary: any
  ) {
    const message = this.formatAlertMessage(threshold, value, summary);

    // 슬랙 알림 전송
    if (process.env.ALERTS_ENABLED === 'true') {
      await slackNotifier.sendAlert(
        threshold.severity,
        `${typeNames[threshold.type]} 임계값 초과`,
        {
          type: threshold.type,
          value,
          threshold: threshold.threshold,
          summary,
        }
      );
    }

    // 로그 기록
    console.error(`[ALERT] ${threshold.severity.toUpperCase()}:`, message);
  }
}
```

---

## 📨 메시지 포맷

### 경고 알림 (Warning)

```json
{
  "text": "분당 요청 수 (RPM) 임계값 초과",
  "attachments": [
    {
      "color": "warning",
      "title": "⚠️ 분당 요청 수 (RPM) 임계값 초과",
      "fields": [
        {
          "title": "항목",
          "value": "rpm",
          "short": true
        },
        {
          "title": "현재 값",
          "value": "12",
          "short": true
        },
        {
          "title": "임계값",
          "value": "10",
          "short": true
        },
        {
          "title": "초과율",
          "value": "120.0%",
          "short": true
        },
        {
          "title": "최근 1분간 요청 수",
          "value": "12건",
          "short": true
        },
        {
          "title": "최근 1분간 토큰 사용량",
          "value": "850,000 TPM",
          "short": true
        }
      ],
      "footer": "chkAI Monitoring System",
      "ts": 1703123456
    }
  ]
}
```

### 위험 알림 (Critical)

```json
{
  "text": "분당 토큰 수 (TPM) 임계값 초과",
  "attachments": [
    {
      "color": "danger",
      "title": "🚨 분당 토큰 수 (TPM) 임계값 초과",
      "fields": [
        {
          "title": "항목",
          "value": "tpm",
          "short": true
        },
        {
          "title": "현재 값",
          "value": "980,000",
          "short": true
        },
        {
          "title": "임계값",
          "value": "950,000",
          "short": true
        },
        {
          "title": "초과율",
          "value": "103.2%",
          "short": true
        }
      ],
      "footer": "chkAI Monitoring System",
      "ts": 1703123456
    }
  ]
}
```

---

## 🧪 테스트 방법

### 1. 웹훅 URL 테스트

```bash
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "테스트 메시지",
    "channel": "#api-monitoring"
  }'
```

### 2. Bot Token 테스트

```bash
curl -X POST https://slack.com/api/chat.postMessage \
  -H 'Authorization: Bearer xoxb-your-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "channel": "C0123456789",
    "text": "테스트 메시지"
  }'
```

---

## 📋 체크리스트

- [ ] 슬랙 워크스페이스 접속
- [ ] Incoming Webhooks 또는 Slack App 생성
- [ ] 웹훅 URL 또는 Bot Token 획득
- [ ] 알림을 받을 채널 생성 (#api-monitoring)
- [ ] 환경 변수 설정
- [ ] 슬랙 알림 테스트
- [ ] 알림 메시지 포맷 확인
- [ ] 임계값 설정 확인

---

## 🔗 참고 자료

- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Slack Web API](https://api.slack.com/web)
- [Slack Block Kit](https://api.slack.com/block-kit)

