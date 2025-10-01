# chkAI 배포 가이드

이 문서는 chkAI 평가 및 Q&A 시스템을 다른 인프라에서 설치하고 사용하는 방법을 설명합니다.

## 📋 목차

1. [시스템 요구사항](#시스템-요구사항)
2. [로컬 개발 환경 설정](#로컬-개발-환경-설정)
3. [Docker를 사용한 배포](#docker를-사용한-배포)
4. [프로덕션 배포](#프로덕션-배포)
5. [데이터베이스 설정](#데이터베이스-설정)
6. [환경 변수 설정](#환경-변수-설정)
7. [문제 해결](#문제-해결)

## 🖥️ 시스템 요구사항

### 최소 요구사항
- **Node.js**: 18.0.0 이상
- **MongoDB**: 5.0 이상
- **메모리**: 2GB 이상
- **디스크**: 10GB 이상

### 권장 요구사항
- **Node.js**: 18.17.0 이상
- **MongoDB**: 7.0 이상
- **메모리**: 4GB 이상
- **디스크**: 20GB 이상

## 🚀 로컬 개발 환경 설정

### 1. 저장소 클론
```bash
git clone https://github.com/wakuwaku-ai-blip/chkAI-eval-qa.git
cd chkAI-eval-qa
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
```bash
cp env.example .env.local
```

`.env.local` 파일을 편집하여 필요한 환경 변수를 설정합니다:
```env
MONGODB_URI=mongodb://localhost:27017/chkAI-eval-qa
PERPLEXITY_API_KEY=your_api_key_here
NODE_ENV=development
```

### 4. MongoDB 설치 및 실행
```bash
# macOS (Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# Windows
# MongoDB Community Server를 다운로드하여 설치
```

### 5. 데이터베이스 초기화
```bash
# 데이터베이스 마이그레이션
npm run db:migrate

# 초기 데이터 시드
npm run db:seed
```

### 6. 개발 서버 실행
```bash
npm run dev
```

애플리케이션이 `http://localhost:3000`에서 실행됩니다.

## 🐳 Docker를 사용한 배포

### 1. Docker 및 Docker Compose 설치
```bash
# Docker Desktop 설치 (권장)
# https://www.docker.com/products/docker-desktop/

# 또는 Docker Engine + Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 2. Docker Compose로 전체 스택 실행
```bash
# 개발 환경 실행
npm run docker:dev

# 또는 직접 실행
docker-compose up -d
```

### 3. 서비스 확인
- **애플리케이션**: http://localhost:3000
- **MongoDB Express**: http://localhost:8081 (admin/admin123)

### 4. 로그 확인
```bash
npm run docker:logs
```

### 5. 서비스 중지
```bash
npm run docker:down
```

## 🏭 프로덕션 배포

### 1. 환경 변수 설정
```bash
cp env.example .env.production
```

프로덕션 환경에 맞게 환경 변수를 설정합니다:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chkAI-eval-qa?retryWrites=true&w=majority
PERPLEXITY_API_KEY=your_production_api_key
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
```

### 2. 애플리케이션 빌드
```bash
npm run build
```

### 3. 프로덕션 서버 실행
```bash
npm start
```

### 4. PM2를 사용한 프로세스 관리 (권장)
```bash
# PM2 설치
npm install -g pm2

# 애플리케이션 실행
pm2 start npm --name "chkAI-app" -- start

# 자동 재시작 설정
pm2 startup
pm2 save
```

## 🗄️ 데이터베이스 설정

### MongoDB Atlas (클라우드)
1. [MongoDB Atlas](https://www.mongodb.com/atlas)에서 계정 생성
2. 클러스터 생성
3. 데이터베이스 사용자 생성
4. 네트워크 액세스 설정
5. 연결 문자열을 `.env` 파일에 설정

### 로컬 MongoDB
```bash
# MongoDB 서비스 시작
sudo systemctl start mongodb

# 데이터베이스 생성
mongo
use chkAI-eval-qa
```

### 데이터베이스 마이그레이션
```bash
# 스키마 및 인덱스 생성
npm run db:migrate

# 초기 데이터 삽입
npm run db:seed
```

## 🔧 환경 변수 설정

### 필수 환경 변수
```env
MONGODB_URI=mongodb://localhost:27017/chkAI-eval-qa
PERPLEXITY_API_KEY=your_api_key_here
```

### 선택적 환경 변수
```env
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here
MAX_FILE_SIZE=10485760
UPLOAD_DIR=public/uploads
```

## 🛠️ 문제 해결

### 일반적인 문제들

#### 1. MongoDB 연결 오류
```bash
# MongoDB 서비스 상태 확인
sudo systemctl status mongodb

# MongoDB 재시작
sudo systemctl restart mongodb
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
# 캐시 정리
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
```

### 로그 확인
```bash
# 애플리케이션 로그
npm run docker:logs

# MongoDB 로그
docker-compose logs mongodb

# 애플리케이션 로그
docker-compose logs app
```

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. 시스템 요구사항 충족 여부
2. 환경 변수 설정
3. 데이터베이스 연결 상태
4. 포트 사용 가능 여부

추가 지원이 필요한 경우 GitHub Issues에 문의하세요.
