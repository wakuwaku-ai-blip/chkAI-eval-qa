// lib/api-middleware.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { userRateLimiter, geminiRateLimiter } from './rate-limiter';

export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Rate Limiting 비활성화 옵션
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return handler(req, res);
    }

    // 사용자 식별 (IP 또는 세션 ID)
    const identifier = 
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
      req.headers['x-real-ip']?.toString() ||
      req.socket.remoteAddress || 
      'unknown';

    // 사용자별 Rate Limit 체크
    const userAllowed = await userRateLimiter.checkLimit(identifier);
    if (!userAllowed) {
      const stats = userRateLimiter.getStats(identifier);
      console.warn('Rate Limit 위반 (사용자):', {
        identifier,
        endpoint: req.url,
        timestamp: new Date().toISOString(),
        stats,
      });
      
      return res.status(429).json({
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: 60,
        remaining: stats.remaining,
        resetAt: stats.resetAt,
      });
    }

    // 전역 Gemini API Rate Limit 체크
    const apiAllowed = await geminiRateLimiter.checkLimit('global');
    if (!apiAllowed) {
      const stats = geminiRateLimiter.getStats('global');
      console.warn('Rate Limit 위반 (전역):', {
        endpoint: req.url,
        timestamp: new Date().toISOString(),
        stats,
      });
      
      return res.status(503).json({
        error: '서비스가 일시적으로 사용량이 많습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: 60,
        remaining: stats.remaining,
        resetAt: stats.resetAt,
      });
    }

    return handler(req, res);
  };
}

