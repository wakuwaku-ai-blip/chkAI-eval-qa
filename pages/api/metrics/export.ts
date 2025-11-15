// pages/api/metrics/export.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { metricsCollector } from '../../../lib/metrics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { timeRange = 'day', format = 'json' } = req.query;

  const metrics = metricsCollector.getMetrics(timeRange as 'hour' | 'day' | 'week');

  if (format === 'csv') {
    // CSV 형식으로 내보내기
    const headers = [
      'timestamp',
      'endpoint',
      'requestId',
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'cachedTokens',
      'cost',
      'duration',
      'status',
      'errorCode',
    ].join(',');

    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.endpoint,
      m.requestId,
      m.inputTokens,
      m.outputTokens,
      m.totalTokens,
      m.cachedTokens || 0,
      m.cost.toFixed(6),
      m.duration,
      m.status,
      m.errorCode || '',
    ].join(','));

    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="metrics-${timeRange}-${Date.now()}.csv"`);
    res.status(200).send(csv);
  } else {
    // JSON 형식으로 내보내기
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="metrics-${timeRange}-${Date.now()}.json"`);
    res.status(200).json({
      timeRange,
      timestamp: new Date().toISOString(),
      metrics,
    });
  }
}

