// lib/rate-limiter.ts
import { LRUCache } from 'lru-cache';

interface RateLimitOptions {
  interval: number; // 제한 시간 (ms)
  uniqueTokenPerInterval: number; // 시간당 허용 요청 수
}

class RateLimiter {
  private cache: LRUCache<string, number[]>;
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = options;
    this.cache = new LRUCache({
      max: 500, // 최대 500명의 사용자 추적
      ttl: options.interval,
    });
  }

  async checkLimit(identifier: string): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.cache.get(identifier) || [];
    
    // 오래된 타임스탬프 제거
    const validTimestamps = timestamps.filter(
      (ts) => now - ts < this.options.interval
    );

    if (validTimestamps.length >= this.options.uniqueTokenPerInterval) {
      return false; // 제한 초과
    }

    validTimestamps.push(now);
    this.cache.set(identifier, validTimestamps);
    return true; // 허용
  }

  getRemainingRequests(identifier: string): number {
    const timestamps = this.cache.get(identifier) || [];
    const now = Date.now();
    const validTimestamps = timestamps.filter(
      (ts) => now - ts < this.options.interval
    );
    return Math.max(0, this.options.uniqueTokenPerInterval - validTimestamps.length);
  }

  getStats(identifier: string) {
    const timestamps = this.cache.get(identifier) || [];
    const now = Date.now();
    const validTimestamps = timestamps.filter(
      (ts) => now - ts < this.options.interval
    );
    return {
      used: validTimestamps.length,
      limit: this.options.uniqueTokenPerInterval,
      remaining: Math.max(0, this.options.uniqueTokenPerInterval - validTimestamps.length),
      resetAt: validTimestamps.length > 0 
        ? new Date(Math.min(...validTimestamps) + this.options.interval)
        : new Date(now + this.options.interval),
    };
  }
}

// Gemini API 제한에 맞춘 Rate Limiter
// 무료 플랜: 15 RPM, 유료 플랜: 360 RPM
const geminiRPM = parseInt(process.env.GEMINI_RPM_LIMIT || '10', 10);
export const geminiRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1분
  uniqueTokenPerInterval: geminiRPM, // 분당 요청 수 (기본 10, 무료 플랜 15의 여유)
});

// 사용자별 Rate Limiter
const userRPM = parseInt(process.env.USER_RPM_LIMIT || '5', 10);
export const userRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1분
  uniqueTokenPerInterval: userRPM, // 사용자당 분당 요청 수 (기본 5)
});

