// pages/api/cache/clear.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { cacheService } from '../../../lib/cache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pattern } = req.body;

  try {
    await cacheService.clear(pattern);
    res.status(200).json({
      success: true,
      message: pattern ? `패턴 "${pattern}"에 해당하는 캐시가 삭제되었습니다.` : '모든 캐시가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      error: '캐시 삭제 중 오류가 발생했습니다.',
    });
  }
}

