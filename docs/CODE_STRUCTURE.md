# 코드 구조 및 구현 계획

이 문서는 서비스 안정성 기능들을 코드에 반영하기 위한 구조와 계획을 정리합니다.

## 📁 파일 구조

### API 엔드포인트 (`/pages/api/`)

```
pages/api/
├── rate-limit.ts              # Rate Limiting 미들웨어 및 API
├── queue/
│   └── status.ts              # 요청 큐 상태 확인 API
├── cache/
│   ├── clear.ts              # 캐시 삭제 API
│   └── stats.ts              # 캐시 통계 API
├── metrics/
│   ├── index.ts              # 사용량 모니터링 API (GET)
│   └── export.ts             # 메트릭 데이터 내보내기 API
├── alerts/
│   ├── config.ts             # 알림 설정 API
│   └── history.ts            # 알림 히스토리 조회 API
├── evaluation/
│   ├── queue.ts              # 평가 작업 큐 관리 API
│   └── status.ts             # 평가 작업 상태 확인 API
└── load-test/
    ├── run.ts                # 부하 테스트 실행 API
    └── results.ts             # 부하 테스트 결과 조회 API
```

### 라이브러리 (`/lib/`)

```
lib/
├── rate-limiter.ts           # Rate Limiting 로직
├── request-queue.ts          # 요청 큐 시스템
├── cache.ts                  # 캐시 서비스 (Redis/메모리)
├── cache-utils.ts            # 캐시 유틸리티
├── metrics.ts                # 메트릭 수집 시스템
├── gemini-client.ts          # Gemini API 클라이언트 (메트릭 수집 포함)
├── evaluation-queue.ts       # 비동기 평가 큐 시스템
├── alert-service.ts          # 알림 서비스 (슬랙 연동)
├── error-handler.ts          # 에러 분류 및 처리
├── retry-utils.ts            # 재시도 유틸리티
└── monitor.ts                # 모니터링 시스템 (주기적 실행)
```

### 모델 (`/models/`)

```
models/
├── ChecklistItem.ts          # 기존 모델
└── EvaluationJob.ts          # 평가 작업 모델 (새로 추가)
```

### 프론트엔드 페이지 (`/pages/`)

```
pages/
├── index.tsx                 # 메인 페이지 (대시보드 버튼 추가)
├── dashboard.tsx             # 사용량 모니터링 대시보드 페이지 (새로 추가)
└── load-test.tsx             # 부하 테스트 페이지 (새로 추가)
```

### 컴포넌트 (`/components/` 또는 `/pages/components/`)

```
components/
└── MetricsDashboard.tsx      # 대시보드 컴포넌트
```

---

## 🔧 구현 상세

### 1. Rate Limiting (`/pages/api/rate-limit.ts`)

**기능:**
- 사용자별 Rate Limit 체크
- 전역 API Rate Limit 체크
- Rate Limit 상태 조회

**엔드포인트:**
- `GET /api/rate-limit/status` - 현재 Rate Limit 상태 조회

**미들웨어:**
- `withRateLimit()` - API 핸들러 래퍼

---

### 2. 요청 큐 시스템 (`/lib/request-queue.ts`)

**기능:**
- 우선순위 기반 요청 큐
- 동시 처리 수 제한
- 큐 상태 관리

**API 엔드포인트:**
- `GET /api/queue/status` - 큐 상태 조회

---

### 3. 캐싱 시스템

#### `/lib/cache.ts`
- Redis 또는 메모리 캐시 구현
- 캐시 서비스 클래스

#### `/lib/cache-utils.ts`
- 캐시 키 생성
- 캐시 조회/저장 유틸리티

#### `/pages/api/cache/clear.ts`
- `POST /api/cache/clear` - 캐시 삭제
- `GET /api/cache/stats` - 캐시 통계

---

### 4. 사용량 모니터링

#### `/lib/metrics.ts`
- 메트릭 수집 시스템
- 실제 API 응답 값 저장

#### `/lib/gemini-client.ts`
- Gemini API 호출 래퍼
- `usageMetadata`에서 실제 값 추출
- 메트릭 자동 기록

#### `/pages/api/metrics/index.ts`
- `GET /api/metrics` - 사용량 통계 조회
- `GET /api/metrics?timeRange=hour` - 시간 범위별 조회

#### `/pages/api/metrics/export.ts`
- `GET /api/metrics/export` - 메트릭 데이터 내보내기 (CSV/JSON)

#### `/pages/dashboard.tsx`
- 사용량 모니터링 대시보드 페이지
- 실시간 통계 표시
- 그래프 및 차트

---

### 5. 비동기 평가 큐

#### `/models/EvaluationJob.ts`
- 평가 작업 모델 (MongoDB)

#### `/lib/evaluation-queue.ts`
- 비동기 평가 큐 시스템
- 백그라운드 작업 처리

#### `/pages/api/evaluation/queue.ts`
- `POST /api/evaluation/queue` - 평가 작업 큐에 추가
- `GET /api/evaluation/queue` - 큐 상태 조회

#### `/pages/api/evaluation/status.ts`
- `GET /api/evaluation/status?jobId=xxx` - 작업 상태 조회
- `GET /api/evaluation/status?itemId=xxx` - 항목별 최신 작업 조회

---

### 6. 에러 처리 및 재시도

#### `/lib/error-handler.ts`
- 에러 분류 시스템
- 사용자 친화적 메시지 생성

#### `/lib/retry-utils.ts`
- 재시도 핸들러
- Exponential Backoff

---

### 7. 부하 테스트

#### `/pages/api/load-test/run.ts`
- `POST /api/load-test/run` - 부하 테스트 실행
- 테스트 설정 및 실행

#### `/pages/api/load-test/results.ts`
- `GET /api/load-test/results` - 테스트 결과 조회
- `GET /api/load-test/results/:testId` - 특정 테스트 결과

#### `/pages/load-test.tsx`
- 부하 테스트 페이지
- 테스트 설정 UI
- 결과 시각화

---

### 8. 알림 시스템

#### `/lib/alert-service.ts`
- 알림 서비스
- 슬랙 연동
- 임계값 체크

#### `/pages/api/alerts/config.ts`
- `GET /api/alerts/config` - 알림 설정 조회
- `POST /api/alerts/config` - 알림 설정 업데이트

#### `/pages/api/alerts/history.ts`
- `GET /api/alerts/history` - 알림 히스토리 조회

---

## 🔔 슬랙 알림 연동 필요사항

자세한 내용은 [SLACK_INTEGRATION.md](./SLACK_INTEGRATION.md)를 참조하세요.

### 요약

**필요한 정보:**
1. **Incoming Webhooks 사용 시:**
   - Slack 웹훅 URL: Slack에서 생성한 웹훅 URL
   - 알림 채널: `#notification`

2. **Slack App 사용 시:**
   - Bot Token: `xoxb-xxxxxxxxxxxx-...`
   - 채널 ID: `C0123456789`

**환경 변수:**
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#notification
SLACK_USERNAME=chkAI Monitor
SLACK_ICON_EMOJI=:warning:
```

**구현 파일:**
- `/lib/slack-notifier.ts` - 슬랙 알림 전송
- `/lib/alert-service.ts` - 알림 서비스 (슬랙 연동)

---

## 🎨 프론트엔드 구조

### 메인 페이지 (`/pages/index.tsx`)

**추가할 버튼:**
1. **사용량 모니터링 대시보드 버튼**
   - 위치: 상단 네비게이션 또는 헤더 영역
   - 아이콘: `📊` 또는 `BarChartOutlined`
   - 텍스트: "사용량 모니터링"
   - 클릭 시 `/dashboard` 페이지로 이동
   - 스타일: Primary 버튼 또는 Link

2. **부하 테스트 버튼**
   - 위치: 상단 네비게이션 또는 헤더 영역 (관리자용)
   - 아이콘: `⚡` 또는 `ThunderboltOutlined`
   - 텍스트: "부하 테스트"
   - 클릭 시 `/load-test` 페이지로 이동
   - 스타일: Default 버튼 또는 Link
   - 권한: 관리자만 표시 (선택적)

**버튼 배치 예시:**
```tsx
// pages/index.tsx 상단에 추가
<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
  <Button 
    type="primary" 
    icon={<BarChartOutlined />}
    onClick={() => window.location.href = '/dashboard'}
  >
    사용량 모니터링
  </Button>
  <Button 
    icon={<ThunderboltOutlined />}
    onClick={() => window.location.href = '/load-test'}
  >
    부하 테스트
  </Button>
</div>
```

### 대시보드 페이지 (`/pages/dashboard.tsx`)

**구성:**
- 페이지 제목: "사용량 모니터링 대시보드"
- 뒤로가기 버튼: 메인 페이지로 이동
- 실시간 사용량 통계 카드 (4개)
  - 총 요청 수 (1일)
  - 성공률
  - 총 토큰 (1일)
  - 총 비용 (1일)
- 실시간 사용량 카드 (최근 1분)
  - RPM (분당 요청 수)
  - TPM (분당 토큰 수)
- 그래프 섹션
  - RPM 추이 그래프 (시간별)
  - TPM 추이 그래프 (시간별)
  - 비용 추이 차트 (시간별)
- 상세 통계 테이블
- 최근 알림 목록 (선택적)
- 자동 새로고침: 30초마다

**API 호출:**
- `GET /api/metrics` - 사용량 통계
- `GET /api/metrics?timeRange=hour` - 시간별 상세 데이터
- `GET /api/alerts/history` - 최근 알림 (선택적)

**구현 예시:**
```tsx
// pages/dashboard.tsx
import { useEffect, useState } from 'react';
import { Button, Card, Statistic, Table, Alert, Spin } from 'antd';
import { ArrowLeftOutlined, BarChartOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // 30초마다
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/metrics');
      const data = await res.json();
      setMetrics(data.summary);
    } catch (error) {
      console.error('메트릭 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/')}
        >
          뒤로가기
        </Button>
        <h1 style={{ margin: 0 }}>
          <BarChartOutlined /> 사용량 모니터링 대시보드
        </h1>
      </div>
      
      {/* 통계 카드 및 그래프 */}
      {/* ... */}
    </div>
  );
}
```

### 부하 테스트 페이지 (`/pages/load-test.tsx`)

**구성:**
- 페이지 제목: "부하 테스트"
- 뒤로가기 버튼: 메인 페이지로 이동
- 테스트 설정 폼
  - 동시 사용자 수 (1-100)
  - 사용자당 요청 수 (1-10)
  - 엔드포인트 선택 (드롭다운)
    - `/api/evaluate`
    - `/api/qa`
    - `/api/evaluation-improvement-qa`
  - 테스트 지속 시간 (초)
- 테스트 실행 버튼
- 실시간 진행 상황
  - 진행률 바
  - 현재 상태 (대기/실행 중/완료)
  - 경과 시간
- 결과 시각화
  - 성공률 원형 차트
  - 응답 시간 분포 그래프
  - 에러율 표시
  - 상세 결과 테이블
- 결과 내보내기 버튼 (CSV/JSON)

**API 호출:**
- `POST /api/load-test/run` - 테스트 실행
  ```json
  {
    "concurrentUsers": 5,
    "requestsPerUser": 2,
    "endpoint": "/api/evaluate",
    "duration": 60
  }
  ```
- `GET /api/load-test/results/:testId` - 결과 조회
- `GET /api/load-test/results` - 최근 테스트 목록

**구현 예시:**
```tsx
// pages/load-test.tsx
import { useState } from 'react';
import { Button, Form, InputNumber, Select, Card, Progress, Table } from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';

export default function LoadTest() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [results, setResults] = useState(null);

  const handleRunTest = async (values: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/load-test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      setTestId(data.testId);
      // 폴링으로 결과 확인
      pollResults(data.testId);
    } catch (error) {
      console.error('테스트 실행 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/')}
        >
          뒤로가기
        </Button>
        <h1 style={{ margin: 0 }}>
          <ThunderboltOutlined /> 부하 테스트
        </h1>
      </div>
      
      <Card title="테스트 설정">
        <Form onFinish={handleRunTest}>
          {/* 폼 필드 */}
        </Form>
      </Card>
      
      {/* 결과 표시 */}
    </div>
  );
}
```

---

## 📦 필요한 패키지

### 백엔드

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",           // Redis 클라이언트 (캐싱)
    "lru-cache": "^10.0.0",        // 메모리 캐시 (Redis 없을 때)
    "axios": "^1.10.0",            // HTTP 클라이언트 (슬랙 알림)
    "@slack/webhook": "^6.1.0"     // 슬랙 웹훅 (선택적)
  }
}
```

### 프론트엔드

```json
{
  "dependencies": {
    "recharts": "^2.10.0",         // 차트 라이브러리
    "antd": "^5.26.0"              // 이미 사용 중
  }
}
```

---

## 🔐 환경 변수 추가

```env
# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPM=10
RATE_LIMIT_TPM=800000

# 캐싱
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true
CACHE_TTL=3600

# 모니터링
METRICS_ENABLED=true
METRICS_RETENTION_DAYS=30

# 알림
ALERTS_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#notification
ALERT_COOLDOWN_MINUTES=5

# 평가 큐
EVALUATION_QUEUE_ENABLED=true
EVALUATION_QUEUE_MAX_CONCURRENT=5
EVALUATION_QUEUE_RETRY_ATTEMPTS=3
```

---

## 📋 구현 순서 권장사항

### Phase 1: 기본 인프라
1. ✅ Rate Limiting 구현
2. ✅ 요청 큐 시스템
3. ✅ 에러 처리 및 재시도

### Phase 2: 모니터링
4. ✅ 메트릭 수집 시스템
5. ✅ Gemini API 클라이언트에 메트릭 수집 추가
6. ✅ 모니터링 대시보드

### Phase 3: 최적화
7. ✅ 캐싱 시스템
8. ✅ 비동기 평가 큐

### Phase 4: 알림 및 테스트
9. ✅ 알림 시스템 (슬랙 연동)
10. ✅ 부하 테스트 도구

---

## 🎯 각 파일별 구현 내용 요약

### `/pages/api/rate-limit.ts`
- Rate Limit 미들웨어
- 상태 조회 API

### `/pages/api/queue/status.ts`
- 큐 상태 조회 API

### `/pages/api/cache/clear.ts`
- 캐시 삭제 API

### `/pages/api/cache/stats.ts`
- 캐시 통계 API

### `/pages/api/metrics/index.ts`
- 사용량 통계 조회 API

### `/pages/api/metrics/export.ts`
- 메트릭 데이터 내보내기 API

### `/pages/api/evaluation/queue.ts`
- 평가 작업 큐 관리 API

### `/pages/api/evaluation/status.ts`
- 평가 작업 상태 확인 API

### `/pages/api/load-test/run.ts`
- 부하 테스트 실행 API

### `/pages/api/load-test/results.ts`
- 부하 테스트 결과 조회 API

### `/pages/api/alerts/config.ts`
- 알림 설정 관리 API

### `/pages/api/alerts/history.ts`
- 알림 히스토리 조회 API

---

## 📝 구현 체크리스트

### 백엔드
- [ ] Rate Limiting 구현 (`/lib/rate-limiter.ts`, `/pages/api/rate-limit.ts`)
- [ ] 요청 큐 시스템 (`/lib/request-queue.ts`, `/pages/api/queue/status.ts`)
- [ ] 캐싱 시스템 (`/lib/cache.ts`, `/lib/cache-utils.ts`, `/pages/api/cache/*.ts`)
- [ ] 메트릭 수집 (`/lib/metrics.ts`, `/lib/gemini-client.ts`, `/pages/api/metrics/*.ts`)
- [ ] 비동기 평가 큐 (`/models/EvaluationJob.ts`, `/lib/evaluation-queue.ts`, `/pages/api/evaluation/*.ts`)
- [ ] 에러 처리 (`/lib/error-handler.ts`, `/lib/retry-utils.ts`)
- [ ] 알림 시스템 (`/lib/alert-service.ts`, `/lib/slack-notifier.ts`, `/pages/api/alerts/*.ts`)
- [ ] 부하 테스트 (`/pages/api/load-test/*.ts`)
- [ ] 모니터링 시스템 (`/lib/monitor.ts`)

### 프론트엔드
- [ ] 대시보드 페이지 (`/pages/dashboard.tsx`)
- [ ] 대시보드 컴포넌트 (`/components/MetricsDashboard.tsx`)
- [ ] 부하 테스트 페이지 (`/pages/load-test.tsx`)
- [ ] 메인 페이지에 버튼 추가 (`/pages/index.tsx`)

### 설정
- [ ] 환경 변수 추가 (`env.example` 업데이트)
- [ ] 패키지 설치 (`package.json` 업데이트)
- [ ] MongoDB 모델 추가 (`/models/EvaluationJob.ts`)

---

## 🔗 참고

- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - 상세 구현 가이드
- [GEMINI_API_LIMITS.md](./GEMINI_API_LIMITS.md) - API 제한사항

