// pages/api/cache/stats.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { cacheService } from '../../../lib/cache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = cacheService.getStats();
    res.status(200).json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      error: '캐시 통계 조회 중 오류가 발생했습니다.',
    });
  }
}

