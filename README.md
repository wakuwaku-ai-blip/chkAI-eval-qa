# chkAI - 평가 및 Q&A 시스템

개인정보보호법 준수를 위한 체크리스트 평가 및 개선 Q&A 시스템입니다. AI 기반 증빙 검증과 자동 평가 기능을 제공합니다.

## 📑 목차

- [프로젝트 소개](#-프로젝트-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시작하기](#-시작하기)
  - [시스템 요구사항](#시스템-요구사항)
  - [빠른 시작](#빠른-시작)
  - [로컬 개발 환경](#로컬-개발-환경)
- [프로젝트 구조](#-프로젝트-구조)
- [API 문서](#-api-문서)
- [환경 변수](#-환경-변수)
- [스크립트 가이드](#-스크립트-가이드)
- [Gemini API 제한사항](#-gemini-api-제한사항)
- [배포](#-배포)
- [트러블슈팅](#-트러블슈팅)
- [기여하기](#-기여하기)
- [라이선스](#-라이선스)

## 🎯 프로젝트 소개

**chkAI**는 개인정보보호법 준수 체크리스트를 효율적으로 관리하고 평가하기 위한 AI 기반 시스템입니다. 

### 핵심 가치
- 🤖 **AI 기반 증빙 검증**: Gemini API를 활용한 증빙 자료 적절성 사전 검증
- 📊 **자동 평가**: 이행현황과 첨부파일을 분석하여 준수율 자동 산출
- 💬 **지능형 Q&A**: 평가 항목별 맞춤형 개선 방안 제안 및 질문 답변
- 📁 **다양한 파일 지원**: PDF, HWP, 이미지 등 다양한 증빙 자료 처리

## ✨ 주요 기능

### 1. 체크리스트 관리
- 체크리스트 항목 CRUD 작업
- 평가 항목별 상세 정보 관리
- 진행률 추적 및 시각화

### 2. AI 기반 증빙 검증
- **사전 검증**: 제출된 증빙 자료의 적절성 AI 검증
- **심각도 분류**: critical, high, medium, low 4단계 분류
- **자동 차단**: 부적절한 증빙 자동 감지 및 평가 중단
- **경고 시스템**: 개선이 필요한 증빙에 대한 경고 및 권고사항 제공

### 3. 자동 평가 시스템
- 이행현황 텍스트 분석
- 첨부파일 내용 추출 및 분석
- 준수율 자동 산출
- 개선 방안 제안

### 4. AI Q&A 시스템
- 평가 항목별 컨텍스트 기반 질문 답변
- 대화 히스토리 관리
- 의미없는 질문 필터링
- 법규 전문가 수준의 답변 제공

### 5. 파일 업로드 및 관리
- **다양한 형식 지원**: PDF, HWP, 이미지, Excel 등
- **HWP 파일 안내**: HWP 파일 업로드 시 수동평가 안내 모달 표시
- **PDF 변환 권장**: 자동 분석을 위한 PDF 변환 방법 안내
- **파일 내용 분석**: 텍스트 추출 및 이미지 분석

## 🛠️ 기술 스택

### Frontend
- **Next.js 14**: React 프레임워크 (App Router)
- **React 18**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **Ant Design**: UI 컴포넌트 라이브러리

### Backend
- **Next.js API Routes**: 서버리스 API
- **MongoDB 7.0**: NoSQL 데이터베이스
- **Mongoose**: MongoDB ODM

### AI & 파일 처리
- **Gemini API**: 증빙 검증 및 평가 AI
- **pdf-parse**: PDF 파일 파싱
- **mammoth**: Word 문서 처리
- **sharp**: 이미지 처리
- **xlsx**: Excel 파일 처리

### 인프라
- **Docker**: 컨테이너화
- **Docker Compose**: 멀티 컨테이너 관리
- **MongoDB Express**: 데이터베이스 관리 도구

## 🚀 시작하기

### 시스템 요구사항

#### 최소 요구사항
- **Node.js**: 18.0.0 이상
- **MongoDB**: 5.0 이상
- **메모리**: 2GB 이상
- **디스크**: 10GB 이상

#### 권장 요구사항
- **Node.js**: 18.17.0 이상
- **MongoDB**: 7.0 이상
- **메모리**: 4GB 이상
- **디스크**: 20GB 이상

### 빠른 시작

#### Docker를 사용한 실행 (권장)

```bash
# 저장소 클론
git clone https://github.com/wakuwaku-ai-blip/chkAI-eval-qa.git
cd chkAI-eval-qa

# 환경 변수 설정
cp env.example .env.local
# .env.local 파일을 편집하여 API 키 설정

# Docker Compose로 실행
npm run docker:dev

# 브라우저에서 http://localhost:3000 접속
```

#### 서비스 접속
- **애플리케이션**: http://localhost:3000
- **MongoDB Express**: http://localhost:8081 (admin/admin123)

### 로컬 개발 환경

```bash
# 1. 저장소 클론
git clone https://github.com/wakuwaku-ai-blip/chkAI-eval-qa.git
cd chkAI-eval-qa

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp env.example .env.local
# .env.local 파일을 편집하여 필요한 값 설정

# 4. MongoDB 설치 및 실행
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# Windows
# MongoDB Community Server를 다운로드하여 설치

# 5. 데이터베이스 초기화
npm run db:migrate
npm run db:seed

# 6. 개발 서버 실행
npm run dev
```

애플리케이션이 `http://localhost:3000`에서 실행됩니다.

## 📁 프로젝트 구조

```
chkAI-eval-qa/
├── pages/                      # Next.js 페이지 및 API
│   ├── api/                    # API 엔드포인트
│   │   ├── checklist.ts        # 체크리스트 CRUD
│   │   ├── evaluate.ts         # 평가 처리 (증빙 검증 포함)
│   │   ├── evaluation-improvement-qa.ts  # 평가 개선 Q&A
│   │   ├── qa.ts               # 일반 Q&A 처리
│   │   └── upload.ts           # 파일 업로드
│   └── index.tsx               # 메인 페이지
├── models/                      # MongoDB 스키마
│   └── ChecklistItem.ts        # 체크리스트 항목 모델
├── lib/                         # 유틸리티 라이브러리
│   └── mongoose.ts             # 데이터베이스 연결
├── scripts/                     # 스크립트
│   ├── migrate.js              # 데이터베이스 마이그레이션
│   ├── mongo-init.js           # MongoDB 초기화
│   └── seed.js                 # 초기 데이터 시드
├── public/                      # 정적 파일
│   └── uploads/                 # 업로드된 파일 저장소
├── docker-compose.yml           # Docker Compose 설정
├── Dockerfile                   # 프로덕션 Docker 이미지
├── Dockerfile.dev              # 개발 Docker 이미지
├── env.example                  # 환경 변수 예제
├── tsconfig.json                # TypeScript 설정
└── package.json                 # 프로젝트 의존성
```

## 📡 API 문서

### 체크리스트 API (`/api/checklist`)

#### GET - 체크리스트 항목 조회
```http
GET /api/checklist
```

**응답:**
```json
[
  {
    "_id": "string",
    "item": "string",
    "requiredEvidence": "string",
    "relatedLaw": "string",
    "details": "string",
    "evaluationMethod": "string",
    "progress": "number",
    "implementationStatus": "string"
  }
]
```

#### POST - 체크리스트 항목 생성
```http
POST /api/checklist
Content-Type: application/json

{
  "item": "string",
  "requiredEvidence": "string",
  "relatedLaw": "string",
  "details": "string",
  "evaluationMethod": "string"
}
```

#### PUT - 체크리스트 항목 수정
```http
PUT /api/checklist
Content-Type: application/json

{
  "_id": "string",
  "item": "string",
  ...
}
```

#### DELETE - 체크리스트 항목 삭제
```http
DELETE /api/checklist
Content-Type: application/json

{
  "_id": "string"
}
```

### 평가 API (`/api/evaluate`)

#### POST - 평가 실행
```http
POST /api/evaluate
Content-Type: application/json

{
  "evaluationMethod": "string",
  "requiredEvidence": "string",
  "resultText": "string",
  "resultFiles": ["string"],
  "implementationStatus": "string"
}
```

**응답:**
```json
{
  "progress": "number",
  "improvement": "string",
  "basis": "string",
  "evidenceAnalysis": {
    "needsEvidence": "boolean",
    "evidenceEvaluation": {...},
    "evidenceValidation": {
      "isAppropriate": "boolean",
      "issues": ["string"],
      "reasons": ["string"],
      "severity": "low|medium|high|critical",
      "recommendations": ["string"],
      "canProceed": "boolean"
    }
  }
}
```

### Q&A API (`/api/qa`)

#### POST - 질문하기
```http
POST /api/qa
Content-Type: application/json

{
  "itemId": "string",
  "question": "string",
  "itemData": {
    "item": "string",
    "requiredEvidence": "string",
    "relatedLaw": "string",
    "details": "string",
    "evaluationMethod": "string"
  }
}
```

**응답:**
```json
{
  "answer": "string",
  "history": [
    {
      "role": "user|assistant",
      "content": "string",
      "timestamp": "Date"
    }
  ]
}
```

#### GET - 대화 히스토리 조회
```http
GET /api/qa?itemId=string
```

#### DELETE - 대화 히스토리 삭제
```http
DELETE /api/qa?itemId=string
```

### 파일 업로드 API (`/api/upload`)

#### POST - 파일 업로드
```http
POST /api/upload
Content-Type: multipart/form-data

file: File
```

**응답:**
```json
{
  "success": "boolean",
  "fileName": "string",
  "filePath": "string",
  "fileSize": "number"
}
```

#### DELETE - 파일 삭제
```http
DELETE /api/upload
Content-Type: application/json

{
  "filePath": "string"
}
```

#### GET - 파일 내용 조회
```http
GET /api/upload?file=string
```

## 🔧 환경 변수

### 필수 환경 변수

```env
# MongoDB 연결 문자열
MONGODB_URI=mongodb://localhost:27017/chkAI-eval-qa

# Gemini API 키 (증빙 검증 및 평가용)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 선택적 환경 변수

```env
# Next.js 설정
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# 파일 업로드 설정
MAX_FILE_SIZE=10485760          # 최대 파일 크기 (10MB)
UPLOAD_DIR=public/uploads       # 업로드 디렉토리

# 환경 설정
NODE_ENV=development            # development | production
```

### 환경 변수 설정 방법

1. `env.example` 파일을 복사하여 `.env.local` 생성
2. 필요한 값들을 설정
3. 프로덕션 환경에서는 `.env.production` 사용

## 📜 스크립트 가이드

### 개발 스크립트

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

### 데이터베이스 스크립트

```bash
# 데이터베이스 마이그레이션 (스키마 생성)
npm run db:migrate

# 초기 데이터 시드
npm run db:seed

# 데이터베이스 초기화 (마이그레이션 + 시드)
npm run db:reset
```

### Docker 스크립트

```bash
# Docker 개발 환경 실행
npm run docker:dev

# Docker 서비스 중지
npm run docker:down

# Docker 로그 확인
npm run docker:logs

# Docker 리소스 정리 (볼륨 포함)
npm run docker:clean
```

## 🔒 Gemini API 제한사항

chkAI 시스템은 Gemini API를 사용하여 증빙 검증 및 평가를 수행합니다. 서비스 안정성을 위해 API 제한사항을 이해하는 것이 중요합니다.

### 요금제별 제한사항 요약

| 항목 | 무료 플랜 | 유료 플랜 | 엔터프라이즈 |
|------|----------|----------|-------------|
| **RPM (분당 요청)** | 15 RPM | 360 RPM | 커스텀 |
| **TPM (분당 토큰)** | 1,000,000 | 2,000,000 | 커스텀 |
| **일일 요청 한도** | ~1,500/일 | 제한 없음 | 커스텀 |
| **동시 처리** | 제한적 | 높음 | 최적화 |
| **SLA** | 없음 | 없음 | 99.9% |

### 예상 처리 용량

#### 무료 플랜
- **권장**: 동시 3명 이하 사용자
- **1명**: ✅ 정상 (10-30초)
- **5명**: ⚠️ 지연 (30-60초)
- **10명**: ❌ 심각한 지연 (60-120초)

#### 유료 플랜
- **권장**: 동시 30명 이하 사용자
- **10명**: ✅ 정상 (10-30초)
- **50명**: ⚠️ 지연 (30-60초)
- **100명**: ❌ 심각한 지연 (60-120초)

### 현재 시스템 사용량

평가 1회당:
- **증빙 검증**: ~6,200-8,400 토큰
- **최종 평가**: ~8,500-16,000 토큰
- **총 토큰**: ~14,700-24,400 토큰/평가

Q&A 1회당:
- **토큰 사용량**: ~2,200-4,800 토큰/질문

### 서비스 안정성 권장사항

1. **요청 큐잉 시스템**: 동시 요청 수 제한
2. **캐싱 전략**: 중복 요청 방지
3. **사용량 모니터링**: 실시간 추적 및 알림
4. **폴백 메커니즘**: API 실패 시 대체 로직
5. **Rate Limiting**: 사용자별 요청 제한

자세한 내용은 [Gemini API 제한사항 가이드](./docs/GEMINI_API_LIMITS.md)를 참조하세요.

## 🚀 배포

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참조하세요.

### 주요 배포 옵션

1. **Docker Compose**: 로컬 및 개발 환경
2. **MongoDB Atlas**: 클라우드 데이터베이스
3. **PM2**: 프로덕션 프로세스 관리
4. **Vercel/Netlify**: 정적 배포 (API 제외)

### 프로덕션 배포 예시

```bash
# 1. 환경 변수 설정
cp env.example .env.production
# .env.production 편집

# 2. 빌드
npm run build

# 3. PM2로 실행
npm install -g pm2
pm2 start npm --name "chkAI-app" -- start
pm2 startup
pm2 save
```

## 🔍 트러블슈팅

### 일반적인 문제들

#### 1. MongoDB 연결 오류

```bash
# MongoDB 서비스 상태 확인
sudo systemctl status mongodb

# MongoDB 재시작
sudo systemctl restart mongodb

# 연결 문자열 확인
echo $MONGODB_URI
```

#### 2. 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :3000
lsof -i :27017

# 프로세스 종료
kill -9 <PID>
```

#### 3. 의존성 설치 오류

```bash
# 캐시 정리 후 재설치
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### 4. Docker 관련 문제

```bash
# Docker 컨테이너 정리
npm run docker:clean

# Docker 이미지 재빌드
docker-compose build --no-cache
docker-compose up -d
```

#### 5. API 키 오류

- `.env.local` 파일에 `GEMINI_API_KEY`가 올바르게 설정되었는지 확인
- API 키가 유효한지 확인
- 환경 변수가 로드되었는지 확인

#### 6. 파일 업로드 오류

- `public/uploads` 디렉토리 권한 확인
- 파일 크기 제한 확인 (`MAX_FILE_SIZE`)
- 지원되는 파일 형식 확인

### 로그 확인

```bash
# Docker 로그
npm run docker:logs

# 특정 서비스 로그
docker-compose logs app
docker-compose logs mongodb
```

## 🤝 기여하기

프로젝트에 기여해주셔서 감사합니다! 기여 방법은 다음과 같습니다:

1. **Fork** 프로젝트
2. **Feature Branch** 생성 (`git checkout -b feature/AmazingFeature`)
3. **변경사항 커밋** (`git commit -m 'Add some AmazingFeature'`)
4. **브랜치에 푸시** (`git push origin feature/AmazingFeature`)
5. **Pull Request** 생성

### 개발 가이드라인

- TypeScript를 사용하여 모든 코드 작성
- ESLint 및 Prettier 규칙 준수
- 의미있는 커밋 메시지 작성
- 새로운 기능에 대한 테스트 작성
- 문서 업데이트

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면:

1. [GitHub Issues](https://github.com/wakuwaku-ai-blip/chkAI-eval-qa/issues)에 문의
2. 시스템 요구사항 충족 여부 확인
3. 환경 변수 설정 확인
4. 데이터베이스 연결 상태 확인
5. 포트 사용 가능 여부 확인

---

**chkAI** - 개인정보보호법 준수를 위한 스마트한 평가 시스템

Made with ❤️ by wakuwaku-ai-blip
