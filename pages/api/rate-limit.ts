// pages/api/rate-limit.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { userRateLimiter, geminiRateLimiter } from '../../lib/rate-limiter';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 사용자 식별
  const identifier = 
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
    req.headers['x-real-ip']?.toString() ||
    req.socket.remoteAddress || 
    'unknown';

  const userStats = userRateLimiter.getStats(identifier);
  const globalStats = geminiRateLimiter.getStats('global');

  res.status(200).json({
    user: {
      identifier,
      ...userStats,
    },
    global: {
      ...globalStats,
    },
    timestamp: new Date().toISOString(),
  });
}

