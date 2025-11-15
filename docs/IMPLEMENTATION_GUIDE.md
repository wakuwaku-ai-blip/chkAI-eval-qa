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

### 구현 방법

#### 4.1 사용량 메트릭 수집

```typescript
// lib/metrics.ts
interface APIMetrics {
  timestamp: Date;
  endpoint: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
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
    const recent = this.getMetrics('day');
    const successful = recent.filter((m) => m.status === 'success');
    
    return {
      totalRequests: recent.length,
      successfulRequests: successful.length,
      errorRate: (recent.length - successful.length) / recent.length,
      totalTokens: recent.reduce((sum, m) => sum + m.totalTokens, 0),
      totalCost: recent.reduce((sum, m) => sum + m.cost, 0),
      avgDuration: successful.reduce((sum, m) => sum + m.duration, 0) / successful.length,
      requestsPerMinute: recent.length / (24 * 60),
      tokensPerMinute: recent.reduce((sum, m) => sum + m.totalTokens, 0) / (24 * 60),
    };
  }

  private async flushToDatabase() {
    // MongoDB에 저장하는 로직 (선택사항)
    // ...
  }
}

export const metricsCollector = new MetricsCollector();
```

#### 4.2 API 호출 래퍼에 메트릭 수집 추가

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
        const response = await fetch(/* ... */);
        const data = await response.json();
        
        // 토큰 사용량 추출
        const usage = data.usageMetadata || {};
        const inputTokens = usage.promptTokenCount || 0;
        const outputTokens = usage.candidatesTokenCount || 0;
        const totalTokens = usage.totalTokenCount || 0;

        // 비용 계산 (Gemini 2.5 Flash 기준)
        const cost = (inputTokens / 1000000) * 0.30 + (outputTokens / 1000000) * 2.50;

        // 메트릭 기록
        metricsCollector.record({
          timestamp: new Date(),
          endpoint: 'gemini-api',
          requestId,
          inputTokens,
          outputTokens,
          totalTokens,
          cost,
          duration: Date.now() - startTime,
          status: 'success',
        });

        return data;
      },
      priority
    );

    return result;
  } catch (error) {
    // 에러 메트릭 기록
    metricsCollector.record({
      timestamp: new Date(),
      endpoint: 'gemini-api',
      requestId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      duration: Date.now() - startTime,
      status: 'error',
      errorCode: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}
```

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
  totalRequests: number;
  successfulRequests: number;
  errorRate: number;
  totalTokens: number;
  totalCost: number;
  avgDuration: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
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
            title="총 요청 수"
            value={summary.totalRequests}
            suffix="건"
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
            title="총 토큰"
            value={summary.totalTokens}
            suffix="토큰"
          />
        </Card>
        <Card>
          <Statistic
            title="총 비용"
            value={summary.totalCost}
            precision={4}
            prefix="$"
          />
        </Card>
      </div>

      {/* 상세 메트릭 */}
      <Card title="상세 통계" style={{ marginTop: 16 }}>
        <Table
          dataSource={[
            { key: '1', label: '평균 응답 시간', value: `${summary.avgDuration.toFixed(2)}ms` },
            { key: '2', label: '분당 요청 수', value: `${summary.requestsPerMinute.toFixed(2)} RPM` },
            { key: '3', label: '분당 토큰 수', value: `${summary.tokensPerMinute.toFixed(0)} TPM` },
          ]}
          columns={[
            { title: '항목', dataIndex: 'label', key: 'label' },
            { title: '값', dataIndex: 'value', key: 'value' },
          ]}
          pagination={false}
        />
      </Card>
    </div>
  );
}
```

---

## 5. 폴백 메커니즘 구현

### 목적
- API 실패 시 기본 규칙 기반 평가로 폴백
- 서비스 가용성 유지
- 사용자 경험 보장

### 구현 방법

#### 5.1 규칙 기반 평가 함수

```typescript
// lib/fallback-evaluator.ts
interface FallbackEvaluationResult {
  progress: number;
  improvement: string;
  basis: string;
  evidenceAnalysis: {
    needsEvidence: boolean;
    evidenceEvaluation: any;
    evidenceValidation: {
      isAppropriate: boolean;
      issues: string[];
      recommendations: string[];
      severity: 'low' | 'medium' | 'high' | 'critical';
      canProceed: boolean;
    };
  };
}

export function fallbackEvaluate(
  evaluationMethod: string,
  requiredEvidence: string,
  resultText: string,
  resultFiles: string[]
): FallbackEvaluationResult {
  // 기본 규칙 기반 평가 로직
  const hasFiles = resultFiles && resultFiles.length > 0;
  const hasText = resultText && resultText.trim().length > 30;
  
  // 증빙 적절성 기본 평가
  let isAppropriate = true;
  const issues: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (!hasFiles && requiresEvidence(requiredEvidence)) {
    isAppropriate = false;
    issues.push('필수 증빙 자료가 제출되지 않았습니다.');
    severity = 'high';
    recommendations.push('체크리스트에서 요구하는 증빙 자료를 제출해주세요.');
  }

  if (hasText && resultText.length < 50) {
    issues.push('이행현황 내용이 부족합니다.');
    severity = severity === 'high' ? 'high' : 'medium';
    recommendations.push('이행현황을 더 구체적으로 작성해주세요.');
  }

  // 기본 진행률 계산
  let progress = 50; // 기본값
  if (hasFiles && hasText) {
    progress = 70;
  }
  if (isAppropriate && hasFiles && hasText && resultText.length > 100) {
    progress = 85;
  }

  return {
    progress,
    improvement: 'AI 평가 시스템이 일시적으로 사용 불가능합니다. 기본 규칙 기반 평가를 수행했습니다.',
    basis: '규칙 기반 평가 (폴백 모드)',
    evidenceAnalysis: {
      needsEvidence: requiresEvidence(requiredEvidence),
      evidenceEvaluation: {
        hasEvidence: hasFiles,
        evidenceQuality: hasFiles ? 'medium' : 'none',
      },
      evidenceValidation: {
        isAppropriate,
        issues,
        recommendations,
        severity,
        canProceed: severity !== 'critical' && severity !== 'high',
      },
    },
  };
}
```

#### 5.2 API 호출 래퍼에 폴백 추가

```typescript
// pages/api/evaluate.ts
import { fallbackEvaluate } from '../../lib/fallback-evaluator';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ... 기존 코드 ...

    let evaluationResult;
    try {
      // AI 평가 시도
      evaluationResult = await callGeminiAPI(/* ... */);
    } catch (error) {
      console.error('AI 평가 실패, 폴백 모드로 전환:', error);
      
      // 폴백 평가 수행
      evaluationResult = fallbackEvaluate(
        evaluationMethod,
        requiredEvidence,
        resultText,
        resultFiles || []
      );

      // 폴백 사용 알림
      console.warn('Fallback evaluation used:', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    res.status(200).json(evaluationResult);
  } catch (error) {
    // 최종 폴백
    const fallbackResult = fallbackEvaluate(
      req.body.evaluationMethod,
      req.body.requiredEvidence,
      req.body.resultText,
      req.body.resultFiles || []
    );
    
    res.status(200).json({
      ...fallbackResult,
      improvement: '시스템 오류로 인해 기본 평가를 수행했습니다. 관리자에게 문의해주세요.',
    });
  }
}
```

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

### 구현 방법

#### 8.1 알림 서비스

```typescript
// lib/alert-service.ts
interface AlertThreshold {
  type: 'rpm' | 'tpm' | 'cost' | 'errorRate' | 'queueLength';
  threshold: number;
  severity: 'warning' | 'critical';
}

class AlertService {
  private thresholds: AlertThreshold[] = [
    { type: 'rpm', threshold: 10, severity: 'warning' },
    { type: 'rpm', threshold: 14, severity: 'critical' },
    { type: 'tpm', threshold: 800000, severity: 'warning' },
    { type: 'tpm', threshold: 950000, severity: 'critical' },
    { type: 'errorRate', threshold: 0.1, severity: 'warning' },
    { type: 'errorRate', threshold: 0.2, severity: 'critical' },
    { type: 'queueLength', threshold: 50, severity: 'warning' },
    { type: 'queueLength', threshold: 100, severity: 'critical' },
  ];

  private alertHistory: Map<string, number> = new Map();
  private cooldownPeriod = 5 * 60 * 1000; // 5분

  async checkAndAlert(metrics: any) {
    for (const threshold of this.thresholds) {
      const value = this.getValue(metrics, threshold.type);
      const alertKey = `${threshold.type}-${threshold.severity}`;

      if (value >= threshold.threshold) {
        // 쿨다운 체크
        const lastAlert = this.alertHistory.get(alertKey) || 0;
        if (Date.now() - lastAlert < this.cooldownPeriod) {
          continue; // 쿨다운 중
        }

        await this.sendAlert(threshold, value);
        this.alertHistory.set(alertKey, Date.now());
      }
    }
  }

  private getValue(metrics: any, type: string): number {
    switch (type) {
      case 'rpm':
        return metrics.requestsPerMinute || 0;
      case 'tpm':
        return metrics.tokensPerMinute || 0;
      case 'cost':
        return metrics.dailyCost || 0;
      case 'errorRate':
        return metrics.errorRate || 0;
      case 'queueLength':
        return metrics.queueLength || 0;
      default:
        return 0;
    }
  }

  private async sendAlert(threshold: AlertThreshold, value: number) {
    const message = this.formatAlertMessage(threshold, value);

    // 이메일 알림 (선택사항)
    // await sendEmail(process.env.ADMIN_EMAIL, 'API 사용량 알림', message);

    // 슬랙 알림 (선택사항)
    // await sendSlack(process.env.SLACK_WEBHOOK, message);

    // 로그 기록
    console.error(`[ALERT] ${threshold.severity.toUpperCase()}:`, message);

    // 데이터베이스에 기록 (선택사항)
    // await saveAlertToDatabase({ threshold, value, message, timestamp: new Date() });
  }

  private formatAlertMessage(threshold: AlertThreshold, value: number): string {
    const typeNames = {
      rpm: '분당 요청 수',
      tpm: '분당 토큰 수',
      cost: '일일 비용',
      errorRate: '에러율',
      queueLength: '큐 대기 길이',
    };

    return `${typeNames[threshold.type]}이(가) 임계값(${threshold.threshold})을 초과했습니다. 현재 값: ${value.toFixed(2)}`;
  }
}

export const alertService = new AlertService();
```

#### 8.2 주기적 모니터링 및 알림

```typescript
// lib/monitor.ts
import { metricsCollector } from './metrics';
import { geminiRequestQueue } from './request-queue';
import { alertService } from './alert-service';

export function startMonitoring() {
  setInterval(async () => {
    // 메트릭 수집
    const summary = metricsCollector.getSummary();
    const queueStatus = geminiRequestQueue.getQueueStatus();

    // 알림 체크
    await alertService.checkAndAlert({
      ...summary,
      queueLength: queueStatus.queueLength,
    });

    // 로그 출력
    console.log('Monitoring:', {
      timestamp: new Date().toISOString(),
      ...summary,
      queueStatus,
    });
  }, 60000); // 1분마다 체크
}

// 서버 시작 시 모니터링 시작
if (typeof window === 'undefined') {
  startMonitoring();
}
```

#### 8.3 API 엔드포인트에 통합

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

  const summary = metricsCollector.getSummary();
  const queueStatus = geminiRequestQueue.getQueueStatus();

  // 알림 체크 및 발송
  await alertService.checkAndAlert({
    ...summary,
    queueLength: queueStatus.queueLength,
  });

  res.status(200).json({
    summary,
    queueStatus,
    timestamp: new Date().toISOString(),
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
  - [ ] 규칙 기반 평가 함수
  - [ ] API 호출 래퍼에 폴백 추가
  - [ ] 폴백 사용 로깅

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

