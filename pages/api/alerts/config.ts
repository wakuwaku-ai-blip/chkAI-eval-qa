// pages/api/alerts/config.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    // 알림 설정 조회
    res.status(200).json({
      enabled: process.env.ALERTS_ENABLED === 'true',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ? '설정됨' : '미설정',
      slackChannel: process.env.SLACK_CHANNEL || '#notification',
      cooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MINUTES || '5', 10),
      thresholds: {
        rpm: {
          warning: 10,
          critical: 14,
        },
        tpm: {
          warning: 800000,
          critical: 950000,
        },
        errorRate: {
          warning: 0.1,
          critical: 0.2,
        },
        queueLength: {
          warning: 50,
          critical: 100,
        },
      },
    });
  } else if (req.method === 'POST') {
    // 알림 설정 업데이트 (환경 변수는 런타임에 변경 불가하므로 읽기 전용)
    res.status(200).json({
      message: '알림 설정은 환경 변수로 관리됩니다.',
      note: '설정 변경을 위해서는 환경 변수를 수정하고 서버를 재시작해야 합니다.',
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

