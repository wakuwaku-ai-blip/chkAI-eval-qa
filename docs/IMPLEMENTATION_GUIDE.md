# 서비스 안정성 구현 가이드

이 문서는 chkAI 시스템의 서비스 안정성을 위한 8가지 핵심 구현사항에 대한 상세 가이드를 제공합니다.

## 📋 목차

1. [Rate Limiting 구현](#1-rate-limiting-구현)
2. [요청 큐잉 시스템 도입](#2-요청-큐잉-시스템-도입)
3. [캐싱 전략 수립](#3-캐싱-전략-수립)
4. [사용량 모니터링 대시보드 구축](#4-사용량-모니터링-대시보드-구축)
5. [폴백 메커니즘 구현](#5-폴백-메커니즘-구현)
6. [에러 처리 및 재시도 로직 검증](#6-에러-처리-및-재시도-로직-검증)
7. [부하 테스트 수행](#7-부하-테스트-수행)
8. [사용량 알림 시스템 구축](#8-사용량-알림-시스템-구축)

---

## 1. Rate Limiting 구현

### 목적
- API 호출 빈도를 제한하여 Gemini API의 Rate Limit 초과 방지
- 사용자별 공정한 리소스 분배
- 서비스 안정성 보장

### 구현 방법

#### 1.1 사용자별 Rate Limiter

```typescript
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
}

// Gemini API 제한에 맞춘 Rate Limiter
export const geminiRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1분
  uniqueTokenPerInterval: 10, // 분당 10개 요청 (무료 플랜 15 RPM의 여유)
});

// 사용자별 Rate Limiter
export const userRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1분
  uniqueTokenPerInterval: 5, // 사용자당 분당 5개 요청
});
```

#### 1.2 API 미들웨어 적용

```typescript
// lib/api-middleware.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { userRateLimiter, geminiRateLimiter } from './rate-limiter';

export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // 사용자 식별 (IP 또는 세션 ID)
    const identifier = req.headers['x-forwarded-for']?.toString() || 
                      req.socket.remoteAddress || 
                      'unknown';

    // 사용자별 Rate Limit 체크
    const userAllowed = await userRateLimiter.checkLimit(identifier);
    if (!userAllowed) {
      return res.status(429).json({
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: 60,
        remaining: userRateLimiter.getRemainingRequests(identifier),
      });
    }

    // 전역 Gemini API Rate Limit 체크
    const apiAllowed = await geminiRateLimiter.checkLimit('global');
    if (!apiAllowed) {
      return res.status(503).json({
        error: '서비스가 일시적으로 사용량이 많습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: 60,
      });
    }

    return handler(req, res);
  };
}
```

#### 1.3 API 엔드포인트에 적용

```typescript
// pages/api/evaluate.ts
import { withRateLimit } from '../../lib/api-middleware';

export default withRateLimit(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 기존 핸들러 로직
  // ...
});
```

### 모니터링

```typescript
// Rate Limit 위반 추적
console.log('Rate Limit 위반:', {
  identifier,
  timestamp: new Date().toISOString(),
  endpoint: req.url,
});
```

---

## 2. 요청 큐잉 시스템 도입

### 목적
- 동시 요청 수를 제어하여 Gemini API의 Rate Limit 준수
- 요청 우선순위 관리
- 부하 분산 및 안정성 향상

### 구현 방법

#### 2.1 우선순위 큐 구현

```typescript
// lib/request-queue.ts
interface QueuedRequest<T> {
  id: string;
  priority: 'high' | 'medium' | 'low';
  request: () => Promise<T>;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

class PriorityRequestQueue<T> {
  private queue: QueuedRequest<T>[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrent: number;
  private currentConcurrent: number = 0;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async enqueue(
    id: string,
    request: () => Promise<T>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id,
        priority,
        request,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // 우선순위에 따라 정렬하여 삽입
      this.insertByPriority(queuedRequest);
      this.process();
    });
  }

  private insertByPriority(request: QueuedRequest<T>) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    let insertIndex = this.queue.length;

    for (let i = 0; i < this.queue.length; i++) {
      const currentPriority = priorityOrder[this.queue[i].priority];
      const newPriority = priorityOrder[request.priority];

      if (newPriority > currentPriority) {
        insertIndex = i;
        break;
      } else if (newPriority === currentPriority) {
        // 같은 우선순위면 시간순
        if (request.timestamp < this.queue[i].timestamp) {
          insertIndex = i;
          break;
        }
      }
    }

    this.queue.splice(insertIndex, 0, request);
  }

  private async process() {
    // 최대 동시 처리 수 확인
    if (this.currentConcurrent >= this.maxConcurrent) {
      return;
    }

    // 큐가 비어있으면 종료
    if (this.queue.length === 0) {
      return;
    }

    // 다음 요청 가져오기
    const nextRequest = this.queue.shift();
    if (!nextRequest) return;

    // 이미 처리 중인 요청은 건너뛰기
    if (this.processing.has(nextRequest.id)) {
      this.process(); // 다음 요청 처리
      return;
    }

    this.processing.add(nextRequest.id);
    this.currentConcurrent++;

    try {
      const result = await nextRequest.request();
      nextRequest.resolve(result);
    } catch (error) {
      nextRequest.reject(error as Error);
    } finally {
      this.processing.delete(nextRequest.id);
      this.currentConcurrent--;

      // 다음 요청 처리 (약간의 지연 후)
      setTimeout(() => this.process(), 100);
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      currentConcurrent: this.currentConcurrent,
      maxConcurrent: this.maxConcurrent,
      processing: Array.from(this.processing),
    };
  }
}

// 전역 요청 큐 인스턴스
export const geminiRequestQueue = new PriorityRequestQueue(5); // 최대 5개 동시 처리
```

#### 2.2 API 호출 래퍼

```typescript
// lib/gemini-client.ts
import { geminiRequestQueue } from './request-queue';
import crypto from 'crypto';

interface GeminiRequest {
  prompt: string;
  files?: Array<{ content: string; mimeType: string }>;
  maxOutputTokens?: number;
  temperature?: number;
}

export async function callGeminiAPI(
  request: GeminiRequest,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  // 요청 ID 생성
  const requestId = crypto
    .createHash('md5')
    .update(JSON.stringify(request) + Date.now())
    .digest('hex');

  // 큐에 추가
  return geminiRequestQueue.enqueue(
    requestId,
    async () => {
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: request.prompt },
              ...(request.files || []).map((file) => ({
                inlineData: {
                  mimeType: file.mimeType,
                  data: file.content,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens || 4096,
          temperature: request.temperature || 0.7,
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      return response.json();
    },
    priority
  );
}
```

#### 2.3 사용 예시

```typescript
// pages/api/evaluate.ts
import { callGeminiAPI } from '../../lib/gemini-client';

// 증빙 검증 (높은 우선순위)
const validationResult = await callGeminiAPI(
  {
    prompt: validationPrompt,
    files: imageAnalyses,
    maxOutputTokens: 4096,
    temperature: 0.1,
  },
  'high' // 높은 우선순위
);

// 최종 평가 (중간 우선순위)
const evaluationResult = await callGeminiAPI(
  {
    prompt: evaluationPrompt,
    files: fileAnalyses,
    maxOutputTokens: 4096,
    temperature: 0.7,
  },
  'medium'
);
```

### 모니터링

```typescript
// 큐 상태 모니터링
setInterval(() => {
  const status = geminiRequestQueue.getQueueStatus();
  console.log('Request Queue Status:', status);
  
  if (status.queueLength > 50) {
    // 알림 발송
    sendAlert('큐 대기 요청이 50개를 초과했습니다.');
  }
}, 60000); // 1분마다 체크
```

---

## 3. 캐싱 전략 수립

### 목적
- 동일한 요청에 대한 중복 API 호출 방지
- 비용 절감 (50-70% 절감 가능)
- 응답 속도 향상

### 구현 방법

#### 3.1 Redis 캐시 구현 (권장)

```typescript
// lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface CacheOptions {
  ttl?: number; // Time to live (초)
  prefix?: string;
}

export class CacheService {
  private prefix: string;

  constructor(prefix: string = 'chkAI:') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(this.prefix + key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(this.prefix + key, ttl, serialized);
      } else {
        await redis.set(this.prefix + key, serialized);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(this.prefix + key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clear(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(this.prefix + pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

export const cacheService = new CacheService();
```

#### 3.2 메모리 캐시 구현 (Redis 없을 때)

```typescript
// lib/memory-cache.ts
import { LRUCache } from 'lru-cache';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache<T> {
  private cache: LRUCache<string, CacheEntry<T>>;

  constructor(maxSize: number = 1000, ttl: number = 3600000) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: ttl,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || 3600000);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const memoryCache = new MemoryCache(1000, 3600000); // 1시간 TTL
```

#### 3.3 캐시 키 생성 및 사용

```typescript
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
```

#### 3.4 API에 캐싱 적용

```typescript
// pages/api/evaluate.ts
import { generateCacheKey, getCachedOrExecute } from '../../lib/cache-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ... 기존 코드 ...

  // 증빙 적절성 검증 캐싱
  const validationCacheKey = generateCacheKey('validation', {
    requiredEvidence,
    resultText: resultText.substring(0, 500), // 처음 500자만 사용
    fileNames: resultFiles,
  });

  const aiValidationResult = await getCachedOrExecute(
    validationCacheKey,
    async () => {
      return await validateEvidenceContentWithAI(
        requiredEvidence,
        resultFiles || [],
        resultText,
        fileAnalyses,
        apiKey
      );
    },
    1800 // 30분 캐시
  );

  // 최종 평가 캐싱
  const evaluationCacheKey = generateCacheKey('evaluation', {
    evaluationMethod,
    requiredEvidence,
    resultText: resultText.substring(0, 1000),
    fileNames: resultFiles,
  });

  const evaluationResult = await getCachedOrExecute(
    evaluationCacheKey,
    async () => {
      // 평가 로직
    },
    3600 // 1시간 캐시
  );
}
```

### 캐시 전략

| 캐시 타입 | TTL | 키 구성 요소 |
|-----------|-----|--------------|
| 증빙 검증 | 30분 | requiredEvidence + resultText(500자) + fileNames |
| 최종 평가 | 1시간 | evaluationMethod + requiredEvidence + resultText(1000자) |
| Q&A | 24시간 | itemId + question (정규화) |

---

## 4. 사용량 모니터링 대시보드 구축

### 목적
- 실시간 API 사용량 추적
- 비용 모니터링
- 이상 징후 조기 발견

### ⚠️ 중요: 실제 API 응답 값 사용

**모든 사용량 통계는 Gemini API 응답의 `usageMetadata`에서 추출한 실제 값을 사용합니다.**

- ❌ **사용하지 않음**: 추정치, 계산된 값, 가정된 값
- ✅ **사용함**: API 응답의 `usageMetadata`에서 받은 실제 값
  - `promptTokenCount`: 실제 입력 토큰 수
  - `candidatesTokenCount`: 실제 출력 토큰 수
  - `totalTokenCount`: 실제 총 토큰 수
  - `cachedContentTokenCount`: 캐시된 토큰 수 (선택적)

**이유:**
- 정확한 비용 계산을 위해 실제 사용량 필요
- Rate Limit 모니터링을 위해 정확한 TPM 값 필요
- 신뢰할 수 있는 모니터링 데이터 확보

### 구현 방법

#### 4.1 사용량 메트릭 수집

```typescript
// lib/metrics.ts
interface APIMetrics {
  timestamp: Date;
  endpoint: string;
  requestId: string;
  inputTokens: number;        // 실제 API 응답의 promptTokenCount
  outputTokens: number;       // 실제 API 응답의 candidatesTokenCount
  totalTokens: number;       // 실제 API 응답의 totalTokenCount
  cachedTokens?: number;     // 실제 API 응답의 cachedContentTokenCount (선택적)
  cost: number;              // 실제 사용량 기반 계산된 비용
  duration: number;
  status: 'success' | 'error';
  errorCode?: string;
}

class MetricsCollector {
  private metrics: APIMetrics[] = [];
  private maxSize: number = 10000;

  record(metric: APIMetrics) {
    this.metrics.push(metric);
    
    // 크기 제한
    if (this.metrics.length > this.maxSize) {
      this.metrics.shift();
    }

    // 주기적으로 DB에 저장 (선택사항)
    if (this.metrics.length % 100 === 0) {
      this.flushToDatabase();
    }
  }

  getMetrics(timeRange: 'hour' | 'day' | 'week' = 'day') {
    const now = Date.now();
    const range = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    }[timeRange];

    return this.metrics.filter(
      (m) => now - m.timestamp.getTime() < range
    );
  }

  getSummary() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // 실제 수집된 메트릭 필터링
    const lastMinute = this.metrics.filter(m => m.timestamp.getTime() >= oneMinuteAgo);
    const lastHour = this.metrics.filter(m => m.timestamp.getTime() >= oneHourAgo);
    const lastDay = this.metrics.filter(m => m.timestamp.getTime() >= oneDayAgo);

    const successfulLastMinute = lastMinute.filter(m => m.status === 'success');
    const successfulLastHour = lastHour.filter(m => m.status === 'success');
    const successfulLastDay = lastDay.filter(m => m.status === 'success');

    // 실제 API 응답 값 기반 계산
    return {
      // 최근 1분간 실제 사용량
      requestsPerMinute: lastMinute.length,  // 실제 1분간 요청 수
      tokensPerMinute: lastMinute.reduce((sum, m) => sum + m.totalTokens, 0),  // 실제 1분간 토큰 사용량
      
      // 최근 1시간간 실제 사용량
      requestsPerHour: lastHour.length,
      tokensPerHour: lastHour.reduce((sum, m) => sum + m.totalTokens, 0),
      costPerHour: lastHour.reduce((sum, m) => sum + m.cost, 0),
      
      // 최근 1일간 실제 사용량
      totalRequests: lastDay.length,
      successfulRequests: successfulLastDay.length,
      failedRequests: lastDay.length - successfulLastDay.length,
      errorRate: lastDay.length > 0 ? (lastDay.length - successfulLastDay.length) / lastDay.length : 0,
      
      // 실제 토큰 사용량 합계 (API 응답의 totalTokenCount 합계)
      totalTokens: lastDay.reduce((sum, m) => sum + m.totalTokens, 0),
      totalInputTokens: lastDay.reduce((sum, m) => sum + m.inputTokens, 0),
      totalOutputTokens: lastDay.reduce((sum, m) => sum + m.outputTokens, 0),
      totalCachedTokens: lastDay.reduce((sum, m) => sum + (m.cachedTokens || 0), 0),
      
      // 실제 비용 합계 (실제 사용량 기반 계산)
      totalCost: lastDay.reduce((sum, m) => sum + m.cost, 0),
      
      // 평균 응답 시간 (성공한 요청만)
      avgDuration: successfulLastDay.length > 0
        ? successfulLastDay.reduce((sum, m) => sum + m.duration, 0) / successfulLastDay.length
        : 0,
    };
  }

  private async flushToDatabase() {
    // MongoDB에 저장하는 로직 (선택사항)
    // ...
  }
}

export const metricsCollector = new MetricsCollector();
```

#### 4.2 API 호출 래퍼에 메트릭 수집 추가 (실제 API 응답 값 사용)

**중요**: Gemini API 응답의 `usageMetadata`에서 실제 토큰 사용량을 추출하여 사용합니다.

```typescript
// lib/gemini-client.ts (수정)
import { metricsCollector } from './metrics';

export async function callGeminiAPI(
  request: GeminiRequest,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<any> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const result = await geminiRequestQueue.enqueue(
      requestId,
      async () => {
        // API 호출 로직
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        // ⚠️ 중요: Gemini API 응답의 실제 usageMetadata에서 토큰 사용량 추출
        // 응답 구조:
        // {
        //   "candidates": [...],
        //   "usageMetadata": {
        //     "promptTokenCount": 6153,        // 실제 입력 토큰 수
        //     "candidatesTokenCount": 244,     // 실제 출력 토큰 수
        //     "totalTokenCount": 8727,        // 실제 총 토큰 수
        //     "cachedContentTokenCount": 5473 // 캐시된 콘텐츠 토큰 수 (선택적)
        //   }
        // }
        
        const usageMetadata = data.usageMetadata;
        if (!usageMetadata) {
          console.warn('usageMetadata가 응답에 없습니다:', data);
        }

        // 실제 API 응답에서 받은 토큰 사용량
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = usageMetadata?.totalTokenCount || 0;
        const cachedTokens = usageMetadata?.cachedContentTokenCount || 0;

        // 비용 계산 (Gemini 2.5 Flash 기준)
        // 입력: $0.30 / 100만 토큰, 출력: $2.50 / 100만 토큰
        const inputCost = (inputTokens / 1000000) * 0.30;
        const outputCost = (outputTokens / 1000000) * 2.50;
        const totalCost = inputCost + outputCost;

        // 실제 사용량 메트릭 기록
        metricsCollector.record({
          timestamp: new Date(),
          endpoint: 'gemini-api',
          requestId,
          inputTokens,      // 실제 API 응답 값
          outputTokens,     // 실제 API 응답 값
          totalTokens,      // 실제 API 응답 값
          cachedTokens,     // 캐시된 토큰 (선택적)
          cost: totalCost,  // 실제 사용량 기반 계산
          duration: Date.now() - startTime,
          status: 'success',
        });

        // 로깅 (디버깅용)
        console.log('Gemini API 사용량:', {
          inputTokens,
          outputTokens,
          totalTokens,
          cachedTokens,
          cost: totalCost.toFixed(6),
        });

        return data;
      },
      priority
    );

    return result;
  } catch (error) {
    // 에러 메트릭 기록 (실제 사용량 없음)
    metricsCollector.record({
      timestamp: new Date(),
      endpoint: 'gemini-api',
      requestId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      cost: 0,
      duration: Date.now() - startTime,
      status: 'error',
      errorCode: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}
```

**실제 API 응답 예시:**
```json
{
  "candidates": [
    {
      "content": {
        "parts": [{"text": "..."}],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 6153,
    "candidatesTokenCount": 244,
    "totalTokenCount": 8727,
    "cachedContentTokenCount": 5473
  }
}
```

**주의사항:**
- `usageMetadata`가 없는 경우를 대비한 기본값 처리 필요
- `cachedContentTokenCount`는 선택적 필드 (캐시 사용 시에만 존재)
- 모든 토큰 값은 실제 API 응답에서 받은 값을 사용 (추정치 사용 금지)

#### 4.3 모니터링 API 엔드포인트

```typescript
// pages/api/metrics.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { metricsCollector } from '../../lib/metrics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { timeRange = 'day' } = req.query;

  const summary = metricsCollector.getSummary();
  const metrics = metricsCollector.getMetrics(timeRange as any);

  res.status(200).json({
    summary,
    metrics: metrics.slice(-100), // 최근 100개만 반환
    timeRange,
  });
}
```

#### 4.4 대시보드 컴포넌트 (프론트엔드)

```typescript
// components/MetricsDashboard.tsx
import { useEffect, useState } from 'react';
import { Card, Statistic, Table, Alert } from 'antd';

interface MetricsSummary {
  // 최근 1분간 실제 사용량
  requestsPerMinute: number;      // 실제 1분간 요청 수
  tokensPerMinute: number;        // 실제 1분간 토큰 사용량 (API 응답의 totalTokenCount 합계)
  
  // 최근 1시간간 실제 사용량
  requestsPerHour: number;
  tokensPerHour: number;
  costPerHour: number;
  
  // 최근 1일간 실제 사용량
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  
  // 실제 토큰 사용량 (API 응답 값 합계)
  totalTokens: number;            // 실제 totalTokenCount 합계
  totalInputTokens: number;       // 실제 promptTokenCount 합계
  totalOutputTokens: number;      // 실제 candidatesTokenCount 합계
  totalCachedTokens: number;      // 실제 cachedContentTokenCount 합계
  
  // 실제 비용 (실제 사용량 기반 계산)
  totalCost: number;
  
  avgDuration: number;
}

export default function MetricsDashboard() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics?timeRange=day');
        const data = await response.json();
        setSummary(data.summary);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // 1분마다 갱신

    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!summary) return <div>No data</div>;

  return (
    <div>
      <h2>API 사용량 모니터링</h2>
      
      {/* 경고 표시 */}
      {summary.errorRate > 0.1 && (
        <Alert
          message="높은 에러율 감지"
          description={`에러율이 ${(summary.errorRate * 100).toFixed(2)}%입니다.`}
          type="warning"
          showIcon
        />
      )}

      {summary.requestsPerMinute > 10 && (
        <Alert
          message="높은 요청량"
          description={`분당 ${summary.requestsPerMinute.toFixed(2)}개 요청이 발생하고 있습니다.`}
          type="info"
          showIcon
        />
      )}

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
        <Card>
          <Statistic
            title="총 요청 수 (1일)"
            value={summary.totalRequests}
            suffix="건"
            description={`성공: ${summary.successfulRequests}건, 실패: ${summary.failedRequests}건`}
          />
        </Card>
        <Card>
          <Statistic
            title="성공률"
            value={(1 - summary.errorRate) * 100}
            precision={2}
            suffix="%"
          />
        </Card>
        <Card>
          <Statistic
            title="총 토큰 (1일)"
            value={summary.totalTokens.toLocaleString()}
            suffix="토큰"
            description={`입력: ${summary.totalInputTokens.toLocaleString()}, 출력: ${summary.totalOutputTokens.toLocaleString()}`}
          />
        </Card>
        <Card>
          <Statistic
            title="총 비용 (1일)"
            value={summary.totalCost}
            precision={6}
            prefix="$"
            description={`시간당: $${summary.costPerHour.toFixed(6)}`}
          />
        </Card>
      </div>

      {/* 실시간 사용량 카드 */}
      <Card title="실시간 사용량 (최근 1분)" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <Statistic
            title="분당 요청 수 (RPM)"
            value={summary.requestsPerMinute}
            suffix="RPM"
            valueStyle={{ color: summary.requestsPerMinute > 10 ? '#cf1322' : '#3f8600' }}
          />
          <Statistic
            title="분당 토큰 수 (TPM)"
            value={summary.tokensPerMinute.toLocaleString()}
            suffix="TPM"
            valueStyle={{ color: summary.tokensPerMinute > 800000 ? '#cf1322' : '#3f8600' }}
          />
        </div>
      </Card>

      {/* 상세 메트릭 */}
      <Card title="상세 통계 (실제 API 사용량 기반)" style={{ marginTop: 16 }}>
        <Table
          dataSource={[
            { key: '1', label: '평균 응답 시간', value: `${summary.avgDuration.toFixed(2)}ms` },
            { key: '2', label: '분당 요청 수 (RPM)', value: `${summary.requestsPerMinute} RPM` },
            { key: '3', label: '분당 토큰 수 (TPM)', value: `${summary.tokensPerMinute.toLocaleString()} TPM` },
            { key: '4', label: '시간당 요청 수', value: `${summary.requestsPerHour}건` },
            { key: '5', label: '시간당 토큰 수', value: `${summary.tokensPerHour.toLocaleString()} 토큰` },
            { key: '6', label: '시간당 비용', value: `$${summary.costPerHour.toFixed(6)}` },
            { key: '7', label: '캐시된 토큰 (1일)', value: `${summary.totalCachedTokens.toLocaleString()} 토큰` },
          ]}
          columns={[
            { title: '항목', dataIndex: 'label', key: 'label' },
            { title: '값 (실제 API 응답 기반)', dataIndex: 'value', key: 'value' },
          ]}
          pagination={false}
        />
        <Alert
          message="모든 값은 Gemini API 응답의 usageMetadata에서 추출한 실제 값입니다."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>
    </div>
  );
}
```

---

## 5. 폴백 메커니즘 구현

### 목적
- API 실패 시 품질을 유지하면서 사용자 경험 보장
- 명확한 에러 처리 및 재시도 안내
- 비동기 처리로 서비스 가용성 유지

### ⚠️ 중요 고려사항

**규칙 기반 평가 폴백의 한계:**
- AI 평가의 정교함과 품질을 규칙 기반으로 대체하기 어려움
- 부정확한 평가 결과로 인한 신뢰도 저하
- 사용자에게 혼란을 줄 수 있음

**권장 접근 방식:**
1. **명확한 에러 메시지**: AI 평가 실패 시 사용자에게 투명하게 안내
2. **자동 재시도 큐**: 실패한 요청을 큐에 넣어 나중에 재시도
3. **부분 폴백**: 증빙 검증만 규칙 기반으로 하고, 최종 평가는 실패 처리
4. **대기 및 재시도**: 사용자에게 대기 시간을 안내하고 자동 재시도

### 구현 방법

#### 5.1 평가 작업 모델 (MongoDB)

```typescript
// models/EvaluationJob.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IEvaluationJob extends Document {
  jobId: string;
  itemId: string; // ChecklistItem의 _id
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'high' | 'medium' | 'low';
  
  // 평가 입력 데이터
  evaluationMethod: string;
  requiredEvidence: string;
  resultText: string;
  resultFiles: string[];
  implementationStatus?: string;
  
  // 평가 결과
  result?: {
    progress: number;
    improvement: string;
    basis: string;
    evidenceAnalysis: any;
  };
  
  // 메타데이터
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  nextRetryAt?: Date;
}

const EvaluationJobSchema: Schema = new Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  itemId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  evaluationMethod: String,
  requiredEvidence: String,
  resultText: String,
  resultFiles: [String],
  implementationStatus: String,
  result: Schema.Types.Mixed,
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  error: String,
  createdAt: { type: Date, default: Date.now, index: true },
  startedAt: Date,
  completedAt: Date,
  nextRetryAt: Date,
}, {
  timestamps: true,
});

export default mongoose.models.EvaluationJob ||
  mongoose.model<IEvaluationJob>('EvaluationJob', EvaluationJobSchema);
```

#### 5.2 비동기 평가 큐 시스템

```typescript
// lib/evaluation-queue.ts
import EvaluationJob, { IEvaluationJob } from '../models/EvaluationJob';
import ChecklistItem from '../models/ChecklistItem';
import { callGeminiAPI } from './gemini-client';
import crypto from 'crypto';

class AsyncEvaluationQueue {
  private processing: Set<string> = new Set();
  private isProcessing = false;

  /**
   * 평가 작업을 큐에 추가 (즉시 응답)
   */
  async enqueue(
    itemId: string,
    evaluationData: {
      evaluationMethod: string;
      requiredEvidence: string;
      resultText: string;
      resultFiles: string[];
      implementationStatus?: string;
    },
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    const jobId = crypto.randomUUID();

    const job = new EvaluationJob({
      jobId,
      itemId,
      status: 'pending',
      priority,
      ...evaluationData,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    });

    await job.save();

    // 백그라운드 처리 시작 (비동기)
    this.processQueue().catch(console.error);

    return jobId;
  }

  /**
   * 큐에서 작업을 처리 (백그라운드)
   */
  async processQueue() {
    // 이미 처리 중이면 스킵
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 우선순위 순으로 대기 중인 작업 조회
      const pendingJobs = await EvaluationJob.find({
        status: { $in: ['pending', 'failed'] },
        $or: [
          { nextRetryAt: { $exists: false } },
          { nextRetryAt: { $lte: new Date() } },
        ],
      })
        .sort({ priority: -1, createdAt: 1 }) // 우선순위 높은 순, 생성 시간 빠른 순
        .limit(5); // 한 번에 최대 5개 처리

      for (const job of pendingJobs) {
        if (this.processing.has(job.jobId)) continue;

        this.processing.add(job.jobId);
        
        try {
          await this.processJob(job);
        } catch (error) {
          console.error(`작업 ${job.jobId} 처리 중 오류:`, error);
        } finally {
          this.processing.delete(job.jobId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 개별 작업 처리
   */
  private async processJob(job: IEvaluationJob) {
    // 상태를 processing으로 변경
    job.status = 'processing';
    job.startedAt = new Date();
    job.attempts++;
    await job.save();

    try {
      // 실제 평가 수행
      const result = await this.performEvaluation(job);

      // 결과 저장
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      await job.save();

      // ChecklistItem 업데이트
      await this.updateChecklistItem(job.itemId, result);

      console.log(`평가 작업 ${job.jobId} 완료`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      job.attempts++;
      
      if (job.attempts >= job.maxAttempts) {
        // 최대 재시도 횟수 초과
        job.status = 'failed';
        job.error = `최대 재시도 횟수 초과: ${errorMessage}`;
        job.completedAt = new Date();
        await job.save();
        
        // 실패 알림 (선택사항)
        await this.notifyFailure(job);
      } else {
        // 재시도 예약
        job.status = 'failed'; // 다음 처리 대기
        job.error = errorMessage;
        
        // Exponential Backoff
        const delay = Math.min(60000 * Math.pow(2, job.attempts - 1), 600000);
        job.nextRetryAt = new Date(Date.now() + delay);
        await job.save();
      }
    }
  }

  /**
   * 실제 평가 수행
   */
  private async performEvaluation(job: IEvaluationJob) {
    // 기존 평가 로직 사용
    // ... callGeminiAPI 호출 등 ...
    
    // 여기서는 간단한 예시
    const evaluationResult = await callGeminiAPI(
      {
        prompt: `평가방법: ${job.evaluationMethod}\n이행현황: ${job.resultText}`,
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
      job.priority
    );

    // 결과 파싱 및 반환
    return {
      progress: evaluationResult.progress || 0,
      improvement: evaluationResult.improvement || '',
      basis: evaluationResult.basis || '',
      evidenceAnalysis: evaluationResult.evidenceAnalysis || {},
    };
  }

  /**
   * ChecklistItem 업데이트
   */
  private async updateChecklistItem(itemId: string, result: any) {
    await ChecklistItem.findByIdAndUpdate(itemId, {
      progress: result.progress,
      improvement: result.improvement,
      status: result.progress >= 80 ? '이행' : 
             result.progress >= 50 ? '부분이행' : '미이행',
    });
  }

  /**
   * 작업 상태 조회
   */
  async getStatus(jobId: string) {
    const job = await EvaluationJob.findOne({ jobId });
    if (!job) return null;

    return {
      jobId: job.jobId,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      nextRetryAt: job.nextRetryAt,
      error: job.error,
      result: job.result,
    };
  }

  /**
   * 특정 항목의 최신 작업 조회
   */
  async getLatestJob(itemId: string) {
    return await EvaluationJob.findOne({ itemId })
      .sort({ createdAt: -1 });
  }

  /**
   * 실패 알림 (선택사항)
   */
  private async notifyFailure(job: IEvaluationJob) {
    // 이메일, 슬랙 등으로 알림 발송
    console.error(`평가 작업 실패: ${job.jobId}`, job.error);
  }
}

export const evaluationQueue = new AsyncEvaluationQueue();

// 주기적으로 큐 처리 (30초마다)
if (typeof window === 'undefined') {
  setInterval(() => {
    evaluationQueue.processQueue().catch(console.error);
  }, 30000);
}
```

#### 5.3 평가 API 엔드포인트 (즉시 응답)

```typescript
// pages/api/evaluate.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { evaluationQueue } from '../../lib/evaluation-queue';
import { classifyError, ErrorType } from '../../lib/error-handler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      itemId,
      evaluationMethod,
      requiredEvidence,
      resultText,
      resultFiles,
      implementationStatus,
    } = req.body;

    if (!itemId || !evaluationMethod || !requiredEvidence || !resultText) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    // 먼저 동기적으로 평가 시도 (빠른 응답 시도)
    try {
      const evaluationResult = await callGeminiAPI(/* ... */);
      
      // 성공 시 즉시 결과 반환
      return res.status(200).json(evaluationResult);
    } catch (error) {
      const errorInfo = classifyError(error);

      // Rate Limit이나 일시적 오류인 경우에만 비동기 큐에 추가
      if (
        errorInfo.retryable &&
        (errorInfo.type === ErrorType.RATE_LIMIT ||
         errorInfo.type === ErrorType.API_ERROR ||
         errorInfo.type === ErrorType.NETWORK_ERROR)
      ) {
        // 비동기 큐에 추가
        const jobId = await evaluationQueue.enqueue(
          itemId,
          {
            evaluationMethod,
            requiredEvidence,
            resultText,
            resultFiles: resultFiles || [],
            implementationStatus,
          },
          'high'
        );

        // 즉시 응답 (202 Accepted)
        return res.status(202).json({
          success: true,
          message: '평가 요청이 접수되었습니다. 평가 가능 시간에 자동으로 평가되어 반영됩니다.',
          jobId,
          status: 'pending',
          note: '페이지를 떠나셔도 평가는 계속 진행되며, 완료 후 자동으로 반영됩니다.',
        });
      }

      // 재시도 불가능한 에러
      return res.status(500).json({
        error: errorInfo.userMessage,
        type: errorInfo.type,
        canRetry: false,
      });
    }
  } catch (error) {
    console.error('Evaluation API error:', error);
    res.status(500).json({
      error: '평가 처리 중 예상치 못한 오류가 발생했습니다.',
    });
  }
}
```

#### 5.4 작업 상태 확인 API

```typescript
// pages/api/evaluate/status.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { evaluationQueue } from '../../../lib/evaluation-queue';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId, itemId } = req.query;

  if (jobId && typeof jobId === 'string') {
    // 특정 작업 조회
    const status = await evaluationQueue.getStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.',
        message: '이미 처리되었거나 존재하지 않는 작업입니다.',
      });
    }

    return res.status(200).json(status);
  }

  if (itemId && typeof itemId === 'string') {
    // 항목의 최신 작업 조회
    const job = await evaluationQueue.getLatestJob(itemId);
    
    if (!job) {
      return res.status(404).json({
        error: '평가 작업을 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      jobId: job.jobId,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      nextRetryAt: job.nextRetryAt,
      error: job.error,
      result: job.result,
    });
  }

  return res.status(400).json({
    error: 'jobId 또는 itemId가 필요합니다.',
  });
}
```

#### 5.5 프론트엔드 처리 (선택적 폴링)

```typescript
// 프론트엔드에서 사용 예시
async function handleEvaluate(data: EvaluationData) {
  try {
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.status === 202) {
      // 비동기 처리 시작됨
      const jobId = result.jobId;
      
      // 사용자에게 안내 메시지 표시
      showMessage({
        type: 'success',
        message: result.message || '평가 요청이 접수되었습니다. 평가 가능 시간에 자동으로 평가되어 반영됩니다.',
        description: result.note || '페이지를 떠나셔도 평가는 계속 진행되며, 완료 후 자동으로 반영됩니다.',
        duration: 5, // 5초 후 자동 닫기
      });

      // 선택적: 페이지에 있을 때만 상태 확인 (폴링)
      // 사용자가 페이지를 떠나도 백그라운드에서 계속 처리됨
      if (shouldPollStatus()) {
        pollJobStatus(jobId, data.itemId);
      }

      // 로컬 스토리지에 jobId 저장 (나중에 확인용)
      localStorage.setItem(`evaluation_${data.itemId}`, jobId);
    } else if (response.ok) {
      // 즉시 평가 완료
      showEvaluationResult(result);
      updateUI(result);
    } else {
      // 에러
      showMessage({
        type: 'error',
        message: result.error || '평가 중 오류가 발생했습니다.',
      });
    }
  } catch (error) {
    showMessage({
      type: 'error',
      message: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
}

// 작업 상태 폴링 (선택적)
function pollJobStatus(jobId: string, itemId: string) {
  const pollInterval = setInterval(async () => {
    try {
      const statusResponse = await fetch(`/api/evaluate/status?jobId=${jobId}`);
      
      if (!statusResponse.ok) {
        clearInterval(pollInterval);
        return;
      }

      const status = await statusResponse.json();

      if (status.status === 'completed') {
        clearInterval(pollInterval);
        localStorage.removeItem(`evaluation_${itemId}`);
        
        // 결과 표시
        showEvaluationResult(status.result);
        updateUI(status.result);
        
        showMessage({
          type: 'success',
          message: '평가가 완료되었습니다.',
        });
      } else if (status.status === 'failed') {
        clearInterval(pollInterval);
        localStorage.removeItem(`evaluation_${itemId}`);
        
        showMessage({
          type: 'error',
          message: '평가 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        });
      }
      // pending 또는 processing 상태면 계속 대기
    } catch (error) {
      console.error('상태 확인 오류:', error);
      // 에러가 나도 계속 폴링 (네트워크 일시적 문제일 수 있음)
    }
  }, 5000); // 5초마다 확인

  // 최대 5분간 폴링 (그 이후는 백그라운드에서 처리)
  setTimeout(() => {
    clearInterval(pollInterval);
  }, 5 * 60 * 1000);
}

// 페이지 로드 시 미완료 작업 확인
function checkPendingEvaluations() {
  const items = document.querySelectorAll('[data-item-id]');
  
  items.forEach((item) => {
    const itemId = item.getAttribute('data-item-id');
    if (!itemId) return;

    const jobId = localStorage.getItem(`evaluation_${itemId}`);
    if (!jobId) return;

    // 작업 상태 확인
    fetch(`/api/evaluate/status?jobId=${jobId}`)
      .then((res) => res.json())
      .then((status) => {
        if (status.status === 'completed') {
          localStorage.removeItem(`evaluation_${itemId}`);
          updateUI(status.result);
        } else if (status.status === 'failed') {
          localStorage.removeItem(`evaluation_${itemId}`);
        }
        // pending이나 processing이면 계속 대기
      })
      .catch(console.error);
  });
}

// 페이지 로드 시 실행
if (typeof window !== 'undefined') {
  window.addEventListener('load', checkPendingEvaluations);
}
```

#### 5.5 부분 폴백 (증빙 검증만)

```typescript
// 증빙 검증 실패 시에만 부분 폴백
async function validateEvidenceWithFallback(
  requiredEvidence: string,
  resultFiles: string[],
  resultText: string
) {
  try {
    // AI 증빙 검증 시도
    return await validateEvidenceContentWithAI(/* ... */);
  } catch (error) {
    console.warn('AI 증빙 검증 실패, 기본 검증으로 폴백:', error);

    // 기본 증빙 검증만 수행 (최종 평가는 실패 처리)
    const hasFiles = resultFiles && resultFiles.length > 0;
    const hasText = resultText && resultText.trim().length > 30;

    return {
      isAppropriate: hasFiles && hasText,
      issues: !hasFiles ? ['증빙 자료가 제출되지 않았습니다.'] : [],
      reasons: !hasFiles ? ['필수 증빙 자료가 누락되었습니다.'] : [],
      severity: !hasFiles ? 'high' : 'low',
      recommendations: !hasFiles
        ? ['체크리스트에서 요구하는 증빙 자료를 제출해주세요.']
        : [],
      canProceed: hasFiles && hasText,
      isFallback: true, // 폴백 사용 표시
    };
  }
}
```

### 권장 전략 요약

| 상황 | 처리 방법 | 사용자 경험 |
|------|-----------|-------------|
| **즉시 평가 성공** | 200 OK로 결과 즉시 반환 | 즉시 결과 확인 가능 |
| **Rate Limit 초과** | 비동기 큐에 추가, 202 Accepted | "평가 가능 시간에 자동으로 평가되어 반영됩니다" 메시지 |
| **일시적 네트워크 오류** | 비동기 큐에 추가, 202 Accepted | 백그라운드에서 자동 재시도 |
| **API 서버 오류 (5xx)** | 비동기 큐에 추가, 202 Accepted | 자동 재시도 후 결과 반영 |
| **Quota 초과** | 명확한 에러 메시지, 500 | "일일 사용량 한도를 초과했습니다" 안내 |
| **영구적 오류** | 명확한 에러 메시지, 500 | 관리자 문의 안내 |

### 주요 특징

**✅ 즉시 응답 (202 Accepted)**
- 사용자가 평가 버튼을 누르면 즉시 응답
- 오래 기다릴 필요 없음
- 페이지를 떠나도 평가는 계속 진행

**✅ 백그라운드 처리**
- MongoDB에 작업 저장
- 30초마다 큐 처리
- 사용자가 로그아웃해도 계속 진행

**✅ 자동 결과 반영**
- 평가 완료 시 ChecklistItem 자동 업데이트
- 사용자가 다시 접속하면 결과 확인 가능

**✅ 선택적 폴링**
- 페이지에 있을 때만 상태 확인 (선택사항)
- localStorage에 jobId 저장하여 나중에 확인 가능

**핵심 원칙:**
- ✅ **즉시 응답**: 사용자가 오래 기다리지 않도록
- ✅ **백그라운드 처리**: 사용자가 떠나도 평가 계속 진행
- ✅ **자동 반영**: 완료 후 자동으로 결과 업데이트
- ✅ **투명성**: 상황을 명확히 안내
- ✅ **품질 유지**: 규칙 기반 폴백 없이 AI 평가만 사용

---

## 6. 에러 처리 및 재시도 로직 검증

### 목적
- 안정적인 에러 처리
- 적절한 재시도 전략
- 사용자 친화적 에러 메시지

### 구현 방법

#### 6.1 개선된 재시도 로직

```typescript
// lib/retry-utils.ts
interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: number[];
}

class RetryHandler {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [429, 500, 502, 503, 504],
      ...options,
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // 재시도 불가능한 에러
        if (!this.isRetryable(error)) {
          throw error;
        }

        // 마지막 시도면 에러 throw
        if (attempt >= this.options.maxRetries) {
          break;
        }

        // 재시도 콜백
        if (onRetry) {
          onRetry(attempt + 1, error as Error);
        }

        // Exponential Backoff
        const delay = Math.min(
          this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt),
          this.options.maxDelay
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Unknown error');
  }

  private isRetryable(error: any): boolean {
    // HTTP 에러 코드 확인
    if (error.response?.status) {
      return this.options.retryableErrors.includes(error.response.status);
    }

    // 네트워크 에러는 재시도 가능
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }
}

export const retryHandler = new RetryHandler({
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 10000,
  backoffMultiplier: 2,
});
```

#### 6.2 에러 분류 및 처리

```typescript
// lib/error-handler.ts
export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  retryAfter?: number;
}

export function classifyError(error: any): ErrorInfo {
  // Rate Limit (429)
  if (error.response?.status === 429) {
    const retryAfter = parseInt(
      error.response.headers['retry-after'] || '60',
      10
    );
    return {
      type: ErrorType.RATE_LIMIT,
      message: 'Rate limit exceeded',
      userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
      retryAfter,
    };
  }

  // Quota Exceeded (403)
  if (error.response?.status === 403) {
    return {
      type: ErrorType.QUOTA_EXCEEDED,
      message: 'Quota exceeded',
      userMessage: '일일 사용량 한도를 초과했습니다. 내일 다시 시도해주세요.',
      retryable: false,
    };
  }

  // Network Error
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network timeout',
      userMessage: '네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
    };
  }

  // API Error (5xx)
  if (error.response?.status >= 500) {
    return {
      type: ErrorType.API_ERROR,
      message: `API error: ${error.response.status}`,
      userMessage: '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
    };
  }

  // Validation Error (4xx)
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return {
      type: ErrorType.VALIDATION_ERROR,
      message: `Validation error: ${error.response.status}`,
      userMessage: '입력 정보를 확인해주세요.',
      retryable: false,
    };
  }

  // Unknown
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: error.message || 'Unknown error',
    userMessage: '예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.',
    retryable: false,
  };
}
```

#### 6.3 통합 에러 처리

```typescript
// pages/api/evaluate.ts
import { retryHandler } from '../../lib/retry-utils';
import { classifyError, ErrorType } from '../../lib/error-handler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ... 기존 코드 ...

    const result = await retryHandler.execute(
      async () => {
        return await callGeminiAPI(/* ... */);
      },
      (attempt, error) => {
        console.warn(`재시도 ${attempt}회:`, error.message);
      }
    );

    res.status(200).json(result);
  } catch (error) {
    const errorInfo = classifyError(error);

    // 에러 로깅
    console.error('Evaluation error:', {
      type: errorInfo.type,
      message: errorInfo.message,
      timestamp: new Date().toISOString(),
    });

    // 사용자 친화적 응답
    res.status(errorInfo.type === ErrorType.QUOTA_EXCEEDED ? 403 : 500).json({
      error: errorInfo.userMessage,
      type: errorInfo.type,
      retryable: errorInfo.retryable,
      retryAfter: errorInfo.retryAfter,
    });
  }
}
```

---

## 7. 부하 테스트 수행

### 목적
- 시스템 한계점 파악
- 병목 지점 식별
- 확장 계획 수립

### 구현 방법

#### 7.1 부하 테스트 스크립트

```typescript
// scripts/load-test.ts
import axios from 'axios';

interface LoadTestConfig {
  concurrentUsers: number;
  requestsPerUser: number;
  endpoint: string;
  requestData: any;
}

class LoadTester {
  async run(config: LoadTestConfig) {
    const results: any[] = [];
    const startTime = Date.now();

    console.log(`부하 테스트 시작: ${config.concurrentUsers}명 동시 사용자`);

    // 동시 사용자 시뮬레이션
    const promises = Array.from({ length: config.concurrentUsers }, (_, i) =>
      this.simulateUser(i, config)
    );

    const userResults = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // 결과 집계
    const allResults = userResults.flat();
    const successful = allResults.filter((r) => r.success);
    const failed = allResults.filter((r) => !r.success);

    const summary = {
      totalRequests: allResults.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      successRate: (successful.length / allResults.length) * 100,
      totalTime,
      avgResponseTime:
        successful.reduce((sum, r) => sum + r.duration, 0) / successful.length,
      minResponseTime: Math.min(...successful.map((r) => r.duration)),
      maxResponseTime: Math.max(...successful.map((r) => r.duration)),
      requestsPerSecond: allResults.length / (totalTime / 1000),
    };

    console.log('부하 테스트 결과:', summary);
    return { summary, details: allResults };
  }

  private async simulateUser(
    userId: number,
    config: LoadTestConfig
  ): Promise<any[]> {
    const results: any[] = [];

    for (let i = 0; i < config.requestsPerUser; i++) {
      const startTime = Date.now();
      try {
        const response = await axios.post(config.endpoint, config.requestData);
        const duration = Date.now() - startTime;

        results.push({
          userId,
          requestId: i,
          success: true,
          status: response.status,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;

        results.push({
          userId,
          requestId: i,
          success: false,
          status: error.response?.status || 0,
          error: error.message,
          duration,
        });
      }

      // 요청 간 간격 (선택사항)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }
}

// 실행 예시
async function main() {
  const tester = new LoadTester();

  // 시나리오 1: 소규모 (5명 동시 사용자)
  console.log('\n=== 시나리오 1: 소규모 (5명) ===');
  await tester.run({
    concurrentUsers: 5,
    requestsPerUser: 2,
    endpoint: 'http://localhost:3000/api/evaluate',
    requestData: {
      evaluationMethod: '테스트',
      requiredEvidence: '테스트 증빙',
      resultText: '테스트 이행현황',
      resultFiles: [],
    },
  });

  // 시나리오 2: 중규모 (10명 동시 사용자)
  console.log('\n=== 시나리오 2: 중규모 (10명) ===');
  await tester.run({
    concurrentUsers: 10,
    requestsPerUser: 2,
    endpoint: 'http://localhost:3000/api/evaluate',
    requestData: {
      evaluationMethod: '테스트',
      requiredEvidence: '테스트 증빙',
      resultText: '테스트 이행현황',
      resultFiles: [],
    },
  });
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### 7.2 k6를 사용한 부하 테스트 (권장)

```javascript
// scripts/load-test-k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 5 },   // 1분간 5명으로 증가
    { duration: '3m', target: 5 },    // 3분간 5명 유지
    { duration: '1m', target: 10 },  // 1분간 10명으로 증가
    { duration: '3m', target: 10 },  // 3분간 10명 유지
    { duration: '1m', target: 0 },   // 1분간 0명으로 감소
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% 요청이 5초 이내
    http_req_failed: ['rate<0.1'],      // 에러율 10% 미만
  },
};

export default function () {
  const payload = JSON.stringify({
    evaluationMethod: '테스트 평가 방법',
    requiredEvidence: '테스트 필요 증빙',
    resultText: '테스트 이행현황 내용',
    resultFiles: [],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post('http://localhost:3000/api/evaluate', payload, params);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 30s': (r) => r.timings.duration < 30000,
  });

  sleep(1);
}
```

#### 7.3 실행 방법

```bash
# k6 설치
brew install k6  # macOS
# 또는 https://k6.io/docs/getting-started/installation/

# 부하 테스트 실행
k6 run scripts/load-test-k6.js

# 결과 예시:
# ✓ status is 200
# ✓ response time < 30s
# ✗ http_req_duration: p(95)<5000
```

---

## 8. 사용량 알림 시스템 구축

### 목적
- 사용량 임계값 초과 시 즉시 알림
- 비용 모니터링
- 장애 예방

### ⚠️ 중요: 실제 API 사용량 기반 알림

**모든 알림 임계값은 실제 Gemini API 응답에서 받은 `usageMetadata` 값을 기반으로 계산합니다.**

- 실제 RPM: 최근 1분간 실제 요청 수
- 실제 TPM: 최근 1분간 실제 `totalTokenCount` 합계
- 실제 비용: 실제 사용량 기반 계산된 비용
- 실제 에러율: 실제 성공/실패 비율

**임계값 설정 예시 (무료 플랜 기준):**
- RPM 경고: 10 (15의 67%)
- RPM 위험: 14 (15의 93%)
- TPM 경고: 800,000 (1,000,000의 80%)
- TPM 위험: 950,000 (1,000,000의 95%)

### 구현 방법

#### 8.1 알림 서비스 (실제 API 사용량 기반)

**중요**: 모든 임계값은 실제 Gemini API 응답에서 받은 `usageMetadata` 값을 기반으로 계산합니다.

```typescript
// lib/alert-service.ts
import { metricsCollector } from './metrics';

interface AlertThreshold {
  type: 'rpm' | 'tpm' | 'cost' | 'errorRate' | 'queueLength';
  threshold: number;
  severity: 'warning' | 'critical';
}

class AlertService {
  private thresholds: AlertThreshold[] = [
    // 무료 플랜 기준 (15 RPM, 1,000,000 TPM)
    { type: 'rpm', threshold: 10, severity: 'warning' },        // 15의 67%
    { type: 'rpm', threshold: 14, severity: 'critical' },        // 15의 93%
    { type: 'tpm', threshold: 800000, severity: 'warning' },     // 1,000,000의 80%
    { type: 'tpm', threshold: 950000, severity: 'critical' },     // 1,000,000의 95%
    { type: 'errorRate', threshold: 0.1, severity: 'warning' },  // 10%
    { type: 'errorRate', threshold: 0.2, severity: 'critical' }, // 20%
    { type: 'queueLength', threshold: 50, severity: 'warning' },
    { type: 'queueLength', threshold: 100, severity: 'critical' },
  ];

  private alertHistory: Map<string, number> = new Map();
  private cooldownPeriod = 5 * 60 * 1000; // 5분

  /**
   * 실제 수집된 메트릭을 기반으로 알림 체크
   */
  async checkAndAlert() {
    // 실제 수집된 메트릭 가져오기
    const recentMetrics = metricsCollector.getMetrics('hour'); // 최근 1시간
    const summary = this.calculateRealTimeMetrics(recentMetrics);

    for (const threshold of this.thresholds) {
      const value = this.getValue(summary, threshold.type);
      const alertKey = `${threshold.type}-${threshold.severity}`;

      if (value >= threshold.threshold) {
        // 쿨다운 체크
        const lastAlert = this.alertHistory.get(alertKey) || 0;
        if (Date.now() - lastAlert < this.cooldownPeriod) {
          continue; // 쿨다운 중
        }

        await this.sendAlert(threshold, value, summary);
        this.alertHistory.set(alertKey, Date.now());
      }
    }
  }

  /**
   * 실제 수집된 메트릭으로부터 실시간 통계 계산
   */
  private calculateRealTimeMetrics(metrics: APIMetrics[]) {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    // 최근 1분간 메트릭
    const lastMinute = metrics.filter(m => m.timestamp.getTime() >= oneMinuteAgo);
    // 최근 1시간간 메트릭
    const lastHour = metrics.filter(m => m.timestamp.getTime() >= oneHourAgo);

    // 실제 API 응답 값 기반 계산
    const successful = lastHour.filter(m => m.status === 'success');
    const failed = lastHour.filter(m => m.status === 'error');

    // 실제 토큰 사용량 합계 (API 응답의 totalTokenCount 합계)
    const totalTokensLastMinute = lastMinute.reduce(
      (sum, m) => sum + m.totalTokens, 0
    );
    const totalTokensLastHour = lastHour.reduce(
      (sum, m) => sum + m.totalTokens, 0
    );

    // 실제 비용 합계 (실제 사용량 기반 계산된 cost 합계)
    const totalCostLastHour = lastHour.reduce(
      (sum, m) => sum + m.cost, 0
    );

    return {
      // 실제 RPM (최근 1분간 요청 수)
      requestsPerMinute: lastMinute.length,
      
      // 실제 TPM (최근 1분간 실제 API 응답의 totalTokenCount 합계)
      tokensPerMinute: totalTokensLastMinute,
      
      // 실제 시간당 토큰 사용량
      tokensPerHour: totalTokensLastHour,
      
      // 실제 비용 (실제 사용량 기반)
      hourlyCost: totalCostLastHour,
      
      // 실제 에러율
      errorRate: lastHour.length > 0 ? failed.length / lastHour.length : 0,
      
      // 총 요청 수
      totalRequests: lastHour.length,
      
      // 성공 요청 수
      successfulRequests: successful.length,
    };
  }

  private getValue(summary: any, type: string): number {
    switch (type) {
      case 'rpm':
        return summary.requestsPerMinute || 0;  // 실제 1분간 요청 수
      case 'tpm':
        return summary.tokensPerMinute || 0;    // 실제 1분간 토큰 사용량
      case 'cost':
        return summary.hourlyCost || 0;         // 실제 시간당 비용
      case 'errorRate':
        return summary.errorRate || 0;           // 실제 에러율
      case 'queueLength':
        return summary.queueLength || 0;        // 큐 길이
      default:
        return 0;
    }
  }

  private async sendAlert(
    threshold: AlertThreshold,
    value: number,
    summary: any
  ) {
    const message = this.formatAlertMessage(threshold, value, summary);

    // 이메일 알림 (선택사항)
    // await sendEmail(process.env.ADMIN_EMAIL, 'API 사용량 알림', message);

    // 슬랙 알림 (선택사항)
    // await sendSlack(process.env.SLACK_WEBHOOK, message);

    // 로그 기록
    console.error(`[ALERT] ${threshold.severity.toUpperCase()}:`, message);

    // 데이터베이스에 기록 (선택사항)
    // await saveAlertToDatabase({
    //   threshold,
    //   value,
    //   summary,  // 실제 사용량 상세 정보 포함
    //   message,
    //   timestamp: new Date()
    // });
  }

  private formatAlertMessage(
    threshold: AlertThreshold,
    value: number,
    summary: any
  ): string {
    const typeNames = {
      rpm: '분당 요청 수 (RPM)',
      tpm: '분당 토큰 수 (TPM)',
      cost: '시간당 비용',
      errorRate: '에러율',
      queueLength: '큐 대기 길이',
    };

    let message = `${typeNames[threshold.type]}이(가) 임계값(${threshold.threshold})을 초과했습니다.\n`;
    message += `현재 값: ${value.toFixed(2)}\n\n`;
    message += `실제 사용량 상세:\n`;
    message += `- 최근 1분간 요청 수: ${summary.requestsPerMinute}건\n`;
    message += `- 최근 1분간 토큰 사용량: ${summary.tokensPerMinute.toLocaleString()} 토큰\n`;
    message += `- 최근 1시간간 토큰 사용량: ${summary.tokensPerHour.toLocaleString()} 토큰\n`;
    message += `- 최근 1시간간 비용: $${summary.hourlyCost.toFixed(6)}\n`;
    message += `- 에러율: ${(summary.errorRate * 100).toFixed(2)}%\n`;
    message += `- 총 요청 수: ${summary.totalRequests}건 (성공: ${summary.successfulRequests}건)`;

    return message;
  }
}

export const alertService = new AlertService();
```

#### 8.2 주기적 모니터링 및 알림 (실제 사용량 기반)

```typescript
// lib/monitor.ts
import { metricsCollector } from './metrics';
import { geminiRequestQueue } from './request-queue';
import { alertService } from './alert-service';

export function startMonitoring() {
  setInterval(async () => {
    // 실제 수집된 메트릭 기반으로 알림 체크
    await alertService.checkAndAlert();

    // 실제 사용량 통계 로그 출력
    const recentMetrics = metricsCollector.getMetrics('hour');
    const summary = metricsCollector.getSummary();
    const queueStatus = geminiRequestQueue.getQueueStatus();

    console.log('Monitoring (실제 사용량 기반):', {
      timestamp: new Date().toISOString(),
      // 실제 API 응답 값 기반 통계
      requestsPerMinute: summary.requestsPerMinute,
      tokensPerMinute: summary.tokensPerMinute,
      totalTokens: summary.totalTokens,
      totalCost: summary.totalCost,
      errorRate: summary.errorRate,
      // 큐 상태
      queueLength: queueStatus.queueLength,
      currentConcurrent: queueStatus.currentConcurrent,
    });
  }, 60000); // 1분마다 체크
}

// 서버 시작 시 모니터링 시작
if (typeof window === 'undefined') {
  startMonitoring();
}
```

#### 8.3 API 엔드포인트에 통합 (실제 사용량 반환)

```typescript
// pages/api/monitor.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { metricsCollector } from '../../lib/metrics';
import { geminiRequestQueue } from '../../lib/request-queue';
import { alertService } from '../../lib/alert-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 실제 수집된 메트릭 기반 통계
  const summary = metricsCollector.getSummary();
  const queueStatus = geminiRequestQueue.getQueueStatus();

  // 실제 사용량 기반 알림 체크
  await alertService.checkAndAlert();

  // 실제 API 응답 값 기반 상세 통계
  const recentMetrics = metricsCollector.getMetrics('hour');
  const detailedStats = {
    // 실제 토큰 사용량 (API 응답의 totalTokenCount 합계)
    totalInputTokens: recentMetrics.reduce((sum, m) => sum + m.inputTokens, 0),
    totalOutputTokens: recentMetrics.reduce((sum, m) => sum + m.outputTokens, 0),
    totalTokens: recentMetrics.reduce((sum, m) => sum + m.totalTokens, 0),
    totalCachedTokens: recentMetrics.reduce((sum, m) => sum + (m.cachedTokens || 0), 0),
    
    // 실제 비용 (실제 사용량 기반 계산)
    totalCost: recentMetrics.reduce((sum, m) => sum + m.cost, 0),
    
    // 실제 요청 통계
    totalRequests: recentMetrics.length,
    successfulRequests: recentMetrics.filter(m => m.status === 'success').length,
    failedRequests: recentMetrics.filter(m => m.status === 'error').length,
  };

  res.status(200).json({
    summary: {
      ...summary,
      // 실제 사용량 상세 정보 추가
      ...detailedStats,
    },
    queueStatus,
    timestamp: new Date().toISOString(),
    note: '모든 값은 Gemini API 응답의 usageMetadata에서 추출한 실제 값입니다.',
  });
}
```

---

## 📝 구현 체크리스트

각 항목의 구현 완료 여부를 체크하세요:

- [ ] Rate Limiting 구현
  - [ ] 사용자별 Rate Limiter 구현
  - [ ] 전역 API Rate Limiter 구현
  - [ ] API 미들웨어 적용
  - [ ] 모니터링 로깅

- [ ] 요청 큐잉 시스템 도입
  - [ ] 우선순위 큐 구현
  - [ ] API 호출 래퍼 구현
  - [ ] 큐 상태 모니터링
  - [ ] 알림 시스템 연동

- [ ] 캐싱 전략 수립
  - [ ] Redis 또는 메모리 캐시 구현
  - [ ] 캐시 키 생성 로직
  - [ ] API에 캐싱 적용
  - [ ] 캐시 무효화 전략

- [ ] 사용량 모니터링 대시보드 구축
  - [ ] 메트릭 수집 시스템
  - [ ] 모니터링 API 엔드포인트
  - [ ] 대시보드 컴포넌트
  - [ ] 실시간 업데이트

- [ ] 폴백 메커니즘 구현
  - [ ] 평가 작업 모델 (EvaluationJob) 생성
  - [ ] 비동기 평가 큐 시스템 구현
  - [ ] 즉시 응답 API (202 Accepted)
  - [ ] 백그라운드 작업 처리 (30초 주기)
  - [ ] 작업 상태 확인 API
  - [ ] ChecklistItem 자동 업데이트
  - [ ] 프론트엔드 선택적 폴링
  - [ ] localStorage를 통한 작업 추적
  - [ ] 페이지 로드 시 미완료 작업 확인

- [ ] 에러 처리 및 재시도 로직 검증
  - [ ] 재시도 핸들러 구현
  - [ ] 에러 분류 시스템
  - [ ] 통합 에러 처리
  - [ ] 사용자 친화적 메시지

- [ ] 부하 테스트 수행
  - [ ] 부하 테스트 스크립트 작성
  - [ ] 다양한 시나리오 테스트
  - [ ] 결과 분석 및 개선

- [ ] 사용량 알림 시스템 구축
  - [ ] 알림 서비스 구현
  - [ ] 임계값 설정
  - [ ] 알림 채널 연동 (이메일/슬랙)
  - [ ] 주기적 모니터링

---

## 🔗 참고 자료

- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Redis Documentation](https://redis.io/docs/)
- [k6 Load Testing](https://k6.io/docs/)
- [Gemini API Documentation](https://ai.google.dev/docs)

---

**마지막 업데이트**: 2024년 12월
**문서 버전**: 1.0.0

