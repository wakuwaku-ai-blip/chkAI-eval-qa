// pages/api/alerts/history.ts
import { NextApiRequest, NextApiResponse } from 'next';

// 간단한 알림 히스토리 저장 (실제로는 DB에 저장하는 것이 좋음)
const alertHistory: Array<{
  timestamp: Date;
  severity: string;
  type: string;
  value: number;
  threshold: number;
}> = [];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limit = 50 } = req.query;

  // 최근 알림만 반환
  const recentAlerts = alertHistory
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, parseInt(limit as string, 10));

  res.status(200).json({
    alerts: recentAlerts,
    total: alertHistory.length,
  });
}

// 알림 히스토리 추가 함수 (alert-service에서 사용)
export function addAlertHistory(alert: {
  severity: string;
  type: string;
  value: number;
  threshold: number;
}) {
  alertHistory.push({
    ...alert,
    timestamp: new Date(),
  });

  // 최대 1000개까지만 저장
  if (alertHistory.length > 1000) {
    alertHistory.shift();
  }
}

