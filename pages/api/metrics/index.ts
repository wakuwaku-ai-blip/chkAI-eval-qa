// pages/api/metrics/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { metricsCollector } from '../../../lib/metrics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { timeRange = 'day' } = req.query;

  const summary = metricsCollector.getSummary();
  const metrics = metricsCollector.getMetrics(timeRange as 'hour' | 'day' | 'week');

  res.status(200).json({
    summary,
    metrics: metrics.slice(-100), // 최근 100개만 반환
    timeRange,
    timestamp: new Date().toISOString(),
  });
}

