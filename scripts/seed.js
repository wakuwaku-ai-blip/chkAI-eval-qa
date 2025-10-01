const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chkAI-eval-qa';

// 체크리스트 아이템 스키마 정의
const ChecklistItemSchema = new mongoose.Schema({
  category: String,
  subCategory: String,
  item: String,
  itemNumber: String,
  evaluationMethod: String,
  requiredEvidence: String,
  relatedLaw: String,
  details: String,
  status: { type: String, default: "" },
  resultText: String,
  resultFiles: [String],
  progress: { type: Number, default: 0 },
  improvement: String,
});

const ChecklistItem = mongoose.model('ChecklistItem', ChecklistItemSchema);

// 초기 데이터
const initialData = [
  {
    category: "정보보호 관리체계",
    subCategory: "정보보호 정책",
    item: "정보보호 정책 수립",
    itemNumber: "1.1.1",
    evaluationMethod: "문서 검토",
    requiredEvidence: "정보보호 정책서",
    relatedLaw: "개인정보보호법 제30조",
    details: "개인정보 처리방침 및 정보보호 정책이 수립되어 있는지 확인",
    status: "",
    progress: 0
  },
  {
    category: "정보보호 관리체계",
    subCategory: "정보보호 정책",
    item: "정보보호 정책 승인",
    itemNumber: "1.1.2",
    evaluationMethod: "문서 검토",
    requiredEvidence: "정보보호 정책 승인서",
    relatedLaw: "개인정보보호법 제30조",
    details: "정보보호 정책이 최고경영자에 의해 승인되었는지 확인",
    status: "",
    progress: 0
  },
  {
    category: "정보보호 관리체계",
    subCategory: "정보보호 조직",
    item: "정보보호 책임자 지정",
    itemNumber: "1.2.1",
    evaluationMethod: "문서 검토",
    requiredEvidence: "정보보호 책임자 지정서",
    relatedLaw: "개인정보보호법 제31조",
    details: "정보보호 책임자가 지정되어 있는지 확인",
    status: "",
    progress: 0
  },
  {
    category: "정보보호 관리체계",
    subCategory: "정보보호 조직",
    item: "정보보호 담당자 교육",
    itemNumber: "1.2.2",
    evaluationMethod: "교육 이수 증명서 검토",
    requiredEvidence: "교육 이수 증명서",
    relatedLaw: "개인정보보호법 제31조",
    details: "정보보호 담당자가 정기적으로 교육을 받고 있는지 확인",
    status: "",
    progress: 0
  },
  {
    category: "개인정보 처리",
    subCategory: "개인정보 수집",
    item: "개인정보 수집 동의",
    itemNumber: "2.1.1",
    evaluationMethod: "동의서 검토",
    requiredEvidence: "개인정보 수집 동의서",
    relatedLaw: "개인정보보호법 제15조",
    details: "개인정보 수집 시 법정 동의를 받고 있는지 확인",
    status: "",
    progress: 0
  }
];

async function seed() {
  try {
    console.log('🌱 초기 데이터 시드를 시작합니다...');
    
    // MongoDB 연결
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB에 연결되었습니다.');

    // 기존 데이터 삭제
    await ChecklistItem.deleteMany({});
    console.log('🗑️ 기존 데이터를 삭제했습니다.');

    // 초기 데이터 삽입
    await ChecklistItem.insertMany(initialData);
    console.log(`✅ ${initialData.length}개의 초기 데이터를 삽입했습니다.`);

    // 삽입된 데이터 확인
    const count = await ChecklistItem.countDocuments();
    console.log(`📊 현재 데이터베이스에 ${count}개의 체크리스트 아이템이 있습니다.`);

    console.log('🎉 초기 데이터 시드가 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 시드 중 오류가 발생했습니다:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB 연결이 종료되었습니다.');
  }
}

seed();
