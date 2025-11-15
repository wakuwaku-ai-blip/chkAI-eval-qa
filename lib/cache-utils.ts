// lib/cache-utils.ts
import crypto from 'crypto';
import { cacheService } from './cache';

export function generateCacheKey(
  type: 'evaluation' | 'qa' | 'validation',
  data: any
): string {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `${type}:${hash}`;
}

export async function getCachedOrExecute<T>(
  cacheKey: string,
  executor: () => Promise<T>,
  ttl: number = 3600 // 1시간 기본
): Promise<T> {
  // 캐시에서 조회
  const cached = await cacheService.get<T>(cacheKey);
  if (cached !== null) {
    console.log('Cache hit:', cacheKey);
    return cached;
  }

  console.log('Cache miss:', cacheKey);
  // 캐시 미스 시 실행
  const result = await executor();
  
  // 결과 캐싱
  await cacheService.set(cacheKey, result, ttl);
  
  return result;
}

