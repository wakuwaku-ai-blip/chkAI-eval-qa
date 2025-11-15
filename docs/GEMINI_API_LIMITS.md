# Gemini API 제한사항 및 성능 가이드

이 문서는 chkAI 시스템에서 사용하는 Gemini API의 제한사항, 성능 특성, 그리고 서비스 안정성을 위한 권장사항을 정리합니다.

## 📊 요금제별 제한사항

### 무료 플랜 (Free Tier)

| 항목 | 제한 | 비고 |
|------|------|------|
| **RPM (Requests Per Minute)** | 15 RPM | 분당 최대 15개 요청 |
| **TPM (Tokens Per Minute)** | 1,000,000 TPM | 분당 최대 100만 토큰 |
| **일일 요청 한도** | 약 1,500 요청/일 | 24시간 기준 |
| **동시 요청** | 제한적 | 동시 처리 능력 낮음 |
| **모델** | gemini-2.5-flash | Flash 모델만 사용 가능 |
| **최대 입력 토큰** | 1,048,576 토큰 | 약 80만 단어 |
| **최대 출력 토큰** | 8,192 토큰 | 단일 요청당 |

### 유료 플랜 (Paid Tier)

| 항목 | 제한 | 비고 |
|------|------|------|
| **RPM (Requests Per Minute)** | 360 RPM | 분당 최대 360개 요청 |
| **TPM (Tokens Per Minute)** | 2,000,000 TPM | 분당 최대 200만 토큰 |
| **일일 요청 한도** | 제한 없음 | 사용량 기반 과금 |
| **동시 요청** | 높음 | 병렬 처리 지원 |
| **모델** | gemini-2.5-flash, gemini-1.5-pro | Pro 모델 사용 가능 |
| **최대 입력 토큰** | 2,097,152 토큰 | 약 160만 단어 |
| **최대 출력 토큰** | 8,192 토큰 | 단일 요청당 |

### 엔터프라이즈 플랜

| 항목 | 제한 | 비고 |
|------|------|------|
| **RPM (Requests Per Minute)** | 커스텀 | 계약에 따라 결정 |
| **TPM (Tokens Per Minute)** | 커스텀 | 계약에 따라 결정 |
| **SLA** | 99.9% | 서비스 수준 보장 |
| **우선 지원** | 예 | 전담 지원 제공 |
| **커스텀 모델** | 가능 | 필요시 협의 |

## 🔍 현재 시스템 사용 현황

### API 호출 지점

현재 chkAI 시스템에서 Gemini API를 호출하는 엔드포인트:

1. **`/api/evaluate`** - 평가 처리
   - 증빙 적절성 검증 (1회 호출)
   - 최종 평가 (1회 호출)
   - **총 2회 호출/평가**

2. **`/api/qa`** - Q&A 처리
   - 질문 답변 (1회 호출/질문)
   - **총 1회 호출/질문**

3. **`/api/evaluation-improvement-qa`** - 평가 개선 Q&A
   - 개선 질문 답변 (1회 호출/질문)
   - **총 1회 호출/질문**

### 토큰 사용량 추정

#### 증빙 적절성 검증 (`validateEvidenceContentWithAI`)
- **입력 토큰**: 약 6,000-8,000 토큰
  - 프롬프트: ~2,000 토큰
  - 파일 내용: ~3,000-5,000 토큰
  - 컨텍스트: ~1,000 토큰
- **출력 토큰**: 약 200-400 토큰 (JSON 응답)
- **총 토큰**: 약 6,200-8,400 토큰/요청

#### 최종 평가 (`evaluate`)
- **입력 토큰**: 약 8,000-15,000 토큰
  - 프롬프트: ~3,000 토큰
  - 파일 내용: ~5,000-10,000 토큰
  - 컨텍스트: ~2,000 토큰
- **출력 토큰**: 약 500-1,000 토큰
- **총 토큰**: 약 8,500-16,000 토큰/요청

#### Q&A (`/api/qa`)
- **입력 토큰**: 약 2,000-4,000 토큰
  - 프롬프트: ~500 토큰
  - 컨텍스트: ~1,000-2,000 토큰
  - 질문: ~500-1,500 토큰
- **출력 토큰**: 약 200-800 토큰
- **총 토큰**: 약 2,200-4,800 토큰/요청

## 📈 동시 처리 능력 분석

### 무료 플랜 기준

#### 시나리오 1: 단일 사용자
- **평가 1회**: 2회 API 호출 (증빙 검증 + 최종 평가)
- **예상 소요 시간**: 10-30초
- **토큰 사용량**: 약 14,700-24,400 토큰
- **처리 가능**: ✅ 문제 없음

#### 시나리오 2: 동시 5명 사용자
- **동시 평가 5건**: 10회 API 호출
- **RPM 제한**: 15 RPM → **제한 초과 가능성 높음** ⚠️
- **예상 소요 시간**: 30-60초 (대기 시간 포함)
- **토큰 사용량**: 약 147,000-244,000 토큰
- **TPM 제한**: 1,000,000 TPM → **여유 있음** ✅

#### 시나리오 3: 동시 10명 사용자
- **동시 평가 10건**: 20회 API 호출
- **RPM 제한**: 15 RPM → **심각한 제한 초과** ❌
- **예상 소요 시간**: 60-120초 (대기 시간 포함)
- **서비스 품질**: **저하 예상** ⚠️

### 유료 플랜 기준

#### 시나리오 1: 동시 10명 사용자
- **동시 평가 10건**: 20회 API 호출
- **RPM 제한**: 360 RPM → **여유 있음** ✅
- **예상 소요 시간**: 10-30초
- **처리 가능**: ✅ 문제 없음

#### 시나리오 2: 동시 50명 사용자
- **동시 평가 50건**: 100회 API 호출
- **RPM 제한**: 360 RPM → **제한 초과 가능성** ⚠️
- **예상 소요 시간**: 30-60초
- **토큰 사용량**: 약 1,470,000-2,440,000 토큰
- **TPM 제한**: 2,000,000 TPM → **제한 근접** ⚠️

#### 시나리오 3: 동시 100명 사용자
- **동시 평가 100건**: 200회 API 호출
- **RPM 제한**: 360 RPM → **심각한 제한 초과** ❌
- **예상 소요 시간**: 60-120초 이상
- **서비스 품질**: **심각한 저하 예상** ❌

## ⚠️ 제한 초과 시 동작

### Rate Limit 초과 (429 에러)
- **증상**: API 요청이 거부됨
- **현재 처리**: 재시도 로직 (최대 3회)
- **사용자 경험**: 응답 지연 또는 실패
- **권장 조치**: 요청 큐잉 시스템 도입

### Quota 초과
- **증상**: 일일/월간 할당량 소진
- **현재 처리**: 에러 반환
- **사용자 경험**: 서비스 중단
- **권장 조치**: 사용량 모니터링 및 알림

## 🛡️ 서비스 안정성을 위한 권장사항

### 1. 요청 큐잉 시스템 도입

```typescript
// 예시: 요청 큐 관리
class APIRequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private maxConcurrent = 5; // 동시 처리 수 제한
  
  async add(request: () => Promise<any>) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent);
      await Promise.all(batch.map(fn => fn()));
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
    }
    
    this.processing = false;
  }
}
```

### 2. 캐싱 전략

- **동일 평가 항목 캐싱**: 같은 증빙 자료에 대한 재평가 방지
- **Q&A 응답 캐싱**: 유사 질문에 대한 응답 재사용
- **TTL 설정**: 캐시 유효기간 관리

### 3. 사용량 모니터링

```typescript
// API 사용량 추적
interface APIUsageMetrics {
  requestsPerMinute: number;
  tokensPerMinute: number;
  dailyRequests: number;
  dailyTokens: number;
  errorRate: number;
}

// 모니터링 대시보드 구축 권장
```

### 4. 폴백 메커니즘

- **API 실패 시**: 기본 규칙 기반 평가로 폴백
- **재시도 전략**: Exponential Backoff 적용
- **사용자 알림**: 서비스 지연 시 투명한 안내

### 5. 요청 최적화

- **불필요한 호출 제거**: 중복 검증 방지
- **토큰 사용량 최적화**: 프롬프트 간소화
- **배치 처리**: 가능한 경우 여러 요청을 하나로 통합

## 📊 예상 처리 용량

### 무료 플랜

| 사용자 수 | 동시 평가 | 처리 시간 | 상태 |
|-----------|-----------|-----------|------|
| 1명 | 1건 | 10-30초 | ✅ 정상 |
| 3명 | 3건 | 20-40초 | ✅ 정상 |
| 5명 | 5건 | 30-60초 | ⚠️ 지연 |
| 10명 | 10건 | 60-120초 | ❌ 심각한 지연 |

**권장**: 무료 플랜은 **동시 3명 이하** 사용 권장

### 유료 플랜

| 사용자 수 | 동시 평가 | 처리 시간 | 상태 |
|-----------|-----------|-----------|------|
| 10명 | 10건 | 10-30초 | ✅ 정상 |
| 30명 | 30건 | 20-40초 | ✅ 정상 |
| 50명 | 50건 | 30-60초 | ⚠️ 지연 |
| 100명 | 100건 | 60-120초 | ❌ 심각한 지연 |

**권장**: 유료 플랜은 **동시 30명 이하** 사용 권장

## 🔧 구현 권장사항

### 1. Rate Limiting 구현

```typescript
// rate-limiter.ts
import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10, // 최대 10개 요청/분
  message: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### 2. 요청 우선순위 큐

```typescript
// priority-queue.ts
interface QueuedRequest {
  priority: 'high' | 'medium' | 'low';
  request: () => Promise<any>;
  timestamp: number;
}

class PriorityQueue {
  private queue: QueuedRequest[] = [];
  
  enqueue(request: QueuedRequest) {
    this.queue.push(request);
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.timestamp - b.timestamp;
    });
  }
}
```

### 3. 사용량 알림 시스템

```typescript
// usage-alert.ts
class UsageAlert {
  private thresholds = {
    rpm: 0.8, // 80% 사용 시 알림
    tpm: 0.8,
    daily: 0.9,
  };
  
  checkUsage(metrics: APIUsageMetrics) {
    if (metrics.requestsPerMinute > this.thresholds.rpm * MAX_RPM) {
      this.sendAlert('RPM 임계값 초과');
    }
    // ...
  }
}
```

## 📝 체크리스트

서비스 배포 전 확인사항:

- [ ] 현재 요금제 확인 및 예상 사용량 계산
- [ ] Rate Limiting 구현
- [ ] 요청 큐잉 시스템 도입
- [ ] 캐싱 전략 수립
- [ ] 사용량 모니터링 대시보드 구축
- [ ] 폴백 메커니즘 구현
- [ ] 에러 처리 및 재시도 로직 검증
- [ ] 부하 테스트 수행
- [ ] 사용량 알림 시스템 구축
- [ ] 문서화 및 운영 가이드 작성

## 🔗 참고 자료

- [Gemini API 공식 문서](https://ai.google.dev/docs)
- [Google AI Studio](https://makersuite.google.com/app/apikey)
- [API 사용량 대시보드](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)

---

**마지막 업데이트**: 2024년 12월
**문서 버전**: 1.0.0

