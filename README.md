# chkAI - 평가 및 Q&A 시스템

개인정보보호법 준수를 위한 체크리스트 평가 및 개선 Q&A 시스템입니다.

## 🚀 빠른 시작

### HWP 파일 처리
- **수동평가 대상**: HWP 파일은 자동 분석이 불가능하여 수동평가 대상으로 분류
- **PDF 변환 권장**: 정확한 평가를 위해 PDF로 변환 후 업로드 권장
- **제한적 참고**: 파일명과 크기 정보만으로 평가에 참고

### Docker를 사용한 실행 (권장)
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

### 로컬 개발 환경
```bash
# 의존성 설치
npm install

# MongoDB 설치 및 실행
# macOS: brew install mongodb-community && brew services start mongodb-community
# Ubuntu: sudo apt-get install mongodb && sudo systemctl start mongodb

# 데이터베이스 초기화
npm run db:migrate
npm run db:seed

# 개발 서버 실행
npm run dev
```

## 📋 주요 기능

- **체크리스트 관리**: 개인정보보호법 준수 체크리스트 항목 관리
- **평가 시스템**: 각 항목별 이행 상태 평가 및 점수 관리
- **AI Q&A**: Perplexity API를 활용한 개선 방안 제안
- **파일 업로드**: 증빙 자료 업로드 및 관리
- **진행률 추적**: 전체 평가 진행률 시각화

## 🛠️ 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes
- **Database**: MongoDB 7.0
- **UI Library**: Ant Design
- **AI Integration**: Perplexity API
- **File Processing**: PDF, HWP, 이미지 파일 지원

## 📁 프로젝트 구조

```
chkAI-eval-qa/
├── pages/
│   ├── api/                 # API 엔드포인트
│   │   ├── checklist.ts     # 체크리스트 CRUD
│   │   ├── evaluate.ts      # 평가 처리
│   │   ├── qa.ts           # Q&A 처리
│   │   └── upload.ts       # 파일 업로드
│   └── index.tsx           # 메인 페이지
├── models/
│   └── ChecklistItem.ts    # MongoDB 스키마
├── lib/
│   └── mongoose.ts         # 데이터베이스 연결
├── scripts/
│   ├── migrate.js         # 데이터베이스 마이그레이션
│   └── seed.js           # 초기 데이터 시드
├── docker-compose.yml     # Docker Compose 설정
└── DEPLOYMENT.md         # 배포 가이드
```

## 🔧 사용 가능한 스크립트

```bash
# 개발
npm run dev              # 개발 서버 실행
npm run build           # 프로덕션 빌드
npm run start           # 프로덕션 서버 실행

# 데이터베이스
npm run db:migrate      # 데이터베이스 마이그레이션
npm run db:seed         # 초기 데이터 시드
npm run db:reset        # 데이터베이스 초기화

# Docker
npm run docker:dev      # Docker 개발 환경 실행
npm run docker:down     # Docker 서비스 중지
npm run docker:logs     # Docker 로그 확인
npm run docker:clean    # Docker 리소스 정리
```

## 🌐 서비스 접속

- **애플리케이션**: http://localhost:3000
- **MongoDB Express**: http://localhost:8081 (admin/admin123)

## 📝 환경 변수

```env
# 데이터베이스
MONGODB_URI=mongodb://localhost:27017/chkAI-eval-qa

# API 키
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# 애플리케이션 설정
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
```

## 🚀 배포

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참조하세요.

### 주요 배포 옵션
1. **Docker Compose**: 로컬 및 개발 환경
2. **MongoDB Atlas**: 클라우드 데이터베이스
3. **PM2**: 프로덕션 프로세스 관리
4. **Vercel/Netlify**: 정적 배포 (API 제외)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 GitHub Issues에 문의해주세요.

---

**chkAI** - 개인정보보호법 준수를 위한 스마트한 평가 시스템