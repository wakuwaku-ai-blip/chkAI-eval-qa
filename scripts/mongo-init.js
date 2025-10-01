// MongoDB 초기화 스크립트
db = db.getSiblingDB('chkAI-eval-qa');

// 사용자 생성
db.createUser({
  user: 'chkAI-user',
  pwd: 'chkAI-password',
  roles: [
    {
      role: 'readWrite',
      db: 'chkAI-eval-qa'
    }
  ]
});

// 컬렉션 생성 및 인덱스 설정
db.createCollection('checklistitems');

// 인덱스 생성
db.checklistitems.createIndex({ category: 1, subCategory: 1 });
db.checklistitems.createIndex({ itemNumber: 1 });
db.checklistitems.createIndex({ status: 1 });

print('✅ MongoDB 초기화가 완료되었습니다.');
print('📊 데이터베이스: chkAI-eval-qa');
print('👤 사용자: chkAI-user');
print('🔑 비밀번호: chkAI-password');
