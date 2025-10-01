const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chkAI-eval-qa';

async function migrate() {
  try {
    console.log('🔄 데이터베이스 마이그레이션을 시작합니다...');
    
    // MongoDB 연결
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB에 연결되었습니다.');

    // 데이터베이스 및 컬렉션 생성
    const db = mongoose.connection.db;
    
    // 인덱스 생성
    await db.collection('checklistitems').createIndex({ category: 1, subCategory: 1 });
    await db.collection('checklistitems').createIndex({ itemNumber: 1 });
    await db.collection('checklistitems').createIndex({ status: 1 });
    console.log('✅ 인덱스가 생성되었습니다.');

    // 컬렉션 통계 확인
    const collections = await db.listCollections().toArray();
    console.log('📊 생성된 컬렉션:', collections.map(c => c.name));

    console.log('🎉 데이터베이스 마이그레이션이 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류가 발생했습니다:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB 연결이 종료되었습니다.');
  }
}

migrate();
