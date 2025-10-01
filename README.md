# 체크리스트 평가 및 Q&A 시스템

정보보호 관련 법규 준수 체크리스트를 평가하고 AI Q&A 기능을 제공하는 웹 애플리케이션입니다.

## 주요 기능

### 📋 체크리스트 관리
- 체크리스트 항목 조회 및 관리
- 카테고리별 분류 및 검색
- 항목별 상세 정보 표시

### 🤖 AI 평가 시스템
- **자동 평가**: 첨부파일과 이행현황을 바탕으로 한 AI 기반 준수율 평가
- **증빙 검증**: 필요한 증빙자료의 적절성 및 완성도 검증
- **객관적 기준**: 필수/권고 항목 구분을 위한 객관적 지표 활용
- **이행여부 연동**: 사용자 선택과 AI 평가 결과 간 일관성 검증

### 💬 AI Q&A 시스템
- **일반 Q&A**: 체크리스트 항목에 대한 질문 및 답변
- **평가 결과 Q&A**: 평가 결과에 대한 상세 문의
- **이상한 문자 필터링**: 의미없는 입력에 대한 자동 감지 및 안내

### 📁 파일 관리
- **다중 파일 업로드**: PDF, 이미지, 텍스트 파일 지원
- **파일 미리보기**: 업로드된 파일의 내용 확인
- **파일 분석**: AI가 파일 내용을 분석하여 평가에 활용

## 기술 스택

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Next.js API Routes
- **AI**: Google Gemini API
- **UI**: Ant Design, Custom CSS
- **File Processing**: PDF, 이미지, 텍스트 파일 처리

## 프로젝트 구조

```
pages/
├── api/
│   ├── checklist.ts          # 체크리스트 데이터 API
│   ├── evaluate.ts           # AI 평가 API
│   ├── qa.ts                 # 일반 Q&A API
│   ├── evaluation-improvement-qa.ts  # 평가 결과 Q&A API
│   └── upload.ts             # 파일 업로드 API
├── index.tsx                 # 메인 페이지
└── _app.tsx                  # 앱 설정

components/
├── FilePreviewModal.tsx      # 파일 미리보기 모달
└── QAModal.tsx              # Q&A 모달

public/
└── uploads/                 # 업로드된 파일 저장소
```

## 주요 기능 상세

### 1. AI 평가 시스템
- **다중 모달 입력**: 텍스트, 이미지, PDF 파일을 동시에 처리
- **증빙 검증**: 자동으로 필요한 증빙자료 판단 및 품질 평가
- **객관적 평가**: 법규 기반의 객관적 기준으로 필수/권고 항목 구분
- **일관성 검증**: 사용자 선택과 AI 평가 결과 간 불일치 감지

### 2. Q&A 시스템
- **컨텍스트 기반 답변**: 체크리스트 항목 정보를 활용한 정확한 답변
- **대화 히스토리**: 이전 대화 내용을 기억하여 연속적인 대화 지원
- **입력 검증**: 의미없는 질문이나 이상한 문자 입력 자동 감지

### 3. 파일 처리
- **다양한 형식 지원**: PDF, 이미지(JPG, PNG, GIF), 텍스트 파일
- **내용 분석**: AI가 파일 내용을 분석하여 평가에 활용
- **미리보기**: 업로드된 파일의 내용을 웹에서 직접 확인

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 프로덕션 빌드
```bash
npm run build
npm start
```

## API 엔드포인트

### 체크리스트 API
- `GET /api/checklist` - 체크리스트 데이터 조회

### 평가 API
- `POST /api/evaluate` - AI 기반 체크리스트 평가
  - 요청: `{ evaluationMethod, requiredEvidence, resultText, resultFiles, implementationStatus }`
  - 응답: `{ progress, improvement, basis, evidenceAnalysis }`

### Q&A API
- `POST /api/qa` - 일반 체크리스트 Q&A
- `POST /api/evaluation-improvement-qa` - 평가 결과 Q&A

### 파일 업로드 API
- `POST /api/upload` - 파일 업로드
- `DELETE /api/upload` - 파일 삭제

## 주요 특징

### 🔒 보안
- 환경 변수를 통한 API 키 관리
- 파일 업로드 시 보안 검증
- 사용자 입력 검증 및 필터링

### 🚀 성능
- Next.js 기반의 서버사이드 렌더링
- 효율적인 파일 처리 및 캐싱
- AI API 호출 최적화

### 🎨 사용자 경험
- 직관적인 UI/UX
- 실시간 파일 미리보기
- 상세한 평가 결과 표시
- 반응형 디자인

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 기여

버그 리포트나 기능 제안은 GitHub Issues를 통해 제출해주세요.

## 문의

프로젝트에 대한 문의사항이 있으시면 GitHub Issues를 통해 연락해주세요.

