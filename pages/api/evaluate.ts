import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';


interface FileAnalysisResult {
  type: 'text' | 'image';
  content: string;
  mimeType?: string; // for images
  fileName: string;
}

// MIME 타입 가져오는 헬퍼 함수
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

// 증빙 필수 여부 자동 판단 함수
function requiresEvidence(requiredEvidence: string): boolean {
  if (!requiredEvidence || requiredEvidence.trim() === '') return false;
  
  const evidenceKeywords = [
    '서류', '증빙', '자료', '문서', '화면캡처', '로그', '기록', '보고서',
    '계획서', '매뉴얼', '가이드', '정책서', '절차서', '지침서',
    '승인서', '검토서', '점검서', '점검표', '체크리스트',
    '교육자료', '교육이수증', '인증서', '자격증', '면허',
    '계약서', '협약서', '합의서', '약정서',
    '시스템로그', '접근로그', '감사로그', '보안로그',
    '화면캡처', '스크린샷', '캡처', '이미지',
    '파일', '첨부', '첨부파일', '업로드', '제출'
  ];
  
  const text = requiredEvidence.toLowerCase();
  return evidenceKeywords.some(keyword => text.includes(keyword.toLowerCase()));
}

// 증빙 충족도 평가 함수
function evaluateEvidenceCompliance(
  requiredEvidence: string, 
  submittedFiles: string[], 
  resultText: string
): {
  hasEvidence: boolean;
  evidenceQuality: 'high' | 'medium' | 'low' | 'none';
  missingEvidence: string[];
  evidenceTypes: string[];
  complianceScore: number;
} {
  const hasEvidence = submittedFiles && submittedFiles.length > 0;
  const evidenceTypes: string[] = [];
  const missingEvidence: string[] = [];
  let complianceScore = 0;
  
  if (!hasEvidence) {
    return {
      hasEvidence: false,
      evidenceQuality: 'none',
      missingEvidence: ['첨부파일이 없습니다'],
      evidenceTypes: [],
      complianceScore: 0
    };
  }
  
  // 제출된 파일 유형 분석
  submittedFiles.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (['.pdf', '.doc', '.docx', '.hwp'].includes(ext)) {
      evidenceTypes.push('문서');
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      evidenceTypes.push('이미지');
    } else if (['.xls', '.xlsx', '.csv'].includes(ext)) {
      evidenceTypes.push('스프레드시트');
    } else {
      evidenceTypes.push('기타');
    }
  });
  
  // HWP 파일이 있는 경우 수동평가 대상으로 분류
  const hasHwpFiles = submittedFiles.some(file => 
    path.extname(file).toLowerCase() === '.hwp'
  );
  
  if (hasHwpFiles) {
    // HWP 파일이 있으면 수동평가 대상으로 분류
    console.log('HWP 파일 감지: 수동평가 대상으로 분류됩니다.');
  }
  
  // 필요증빙에서 요구하는 증빙 유형 추출
  const requiredTypes = [];
  const text = requiredEvidence.toLowerCase();
  
  if (text.includes('서류') || text.includes('문서') || text.includes('보고서')) {
    requiredTypes.push('문서');
  }
  if (text.includes('화면') || text.includes('캡처') || text.includes('스크린샷')) {
    requiredTypes.push('이미지');
  }
  if (text.includes('로그') || text.includes('기록')) {
    requiredTypes.push('로그');
  }
  if (text.includes('계획서') || text.includes('정책서') || text.includes('절차서')) {
    requiredTypes.push('문서');
  }
  
  // 증빙 품질 평가
  let evidenceQuality: 'high' | 'medium' | 'low' = 'low';
  
  // 고품질 증빙 조건
  if (evidenceTypes.includes('문서') && evidenceTypes.includes('이미지')) {
    evidenceQuality = 'high';
    complianceScore = 90;
  } else if (evidenceTypes.includes('문서') || evidenceTypes.includes('이미지')) {
    evidenceQuality = 'medium';
    complianceScore = 70;
  } else {
    evidenceQuality = 'low';
    complianceScore = 50;
  }
  
  // 이행현황 텍스트에서 증빙 관련 내용 확인
  const resultTextLower = resultText.toLowerCase();
  const hasEvidenceDescription = [
    '첨부', '제출', '첨부파일', '서류', '문서', '화면', '캡처', '로그', '기록'
  ].some(keyword => resultTextLower.includes(keyword));
  
  if (hasEvidenceDescription) {
    complianceScore += 10;
    if (complianceScore > 100) complianceScore = 100;
  }
  
  // 누락된 증빙 유형 확인
  requiredTypes.forEach(type => {
    if (!evidenceTypes.includes(type)) {
      missingEvidence.push(`${type} 유형의 증빙이 누락되었습니다`);
    }
  });
  
  return {
    hasEvidence,
    evidenceQuality,
    missingEvidence,
    evidenceTypes,
    complianceScore
  };
}

// 증빙 내용 적절성 검증 함수 (개선된 버전)
function validateEvidenceContent(
  requiredEvidence: string,
  submittedFiles: string[],
  resultText: string,
  evaluationMethod: string
): {
  isRelevant: boolean;
  isAppropriate: boolean;
  isComplete: boolean;
  validationScore: number;
  issues: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  canProceed: boolean;
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let validationScore = 100;
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let canProceed = true;

  // 1. 증빙 관련성 검증 (유연한 기준 적용)
  const relevanceResult = checkEvidenceRelevanceFlexible(requiredEvidence, submittedFiles, resultText);
  if (!relevanceResult.isRelevant) {
    if (relevanceResult.severity === 'high') {
      issues.push('제출된 증빙이 체크리스트 항목과 관련성이 없습니다');
      validationScore -= 20; // 기존 30에서 20으로 완화
      severity = 'high';
    } else {
      issues.push('제출된 증빙의 관련성을 더 명확히 해주세요');
      validationScore -= 10;
      severity = 'medium';
    }
    recommendations.push('체크리스트 항목과 직접적으로 관련된 증빙을 제출해주세요');
  }

  // 2. 증빙 적절성 검증 (유연한 기준 적용)
  const appropriatenessResult = checkEvidenceAppropriatenessFlexible(requiredEvidence, submittedFiles);
  if (!appropriatenessResult.isAppropriate) {
    if (appropriatenessResult.severity === 'high') {
      const requiredTypes = extractRequiredEvidenceTypes(requiredEvidence);
      const submittedTypes = submittedFiles.map(file => {
        const ext = path.extname(file).toLowerCase();
        if (['.pdf', '.doc', '.docx', '.hwp'].includes(ext)) return '문서';
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return '이미지';
        if (['.xls', '.xlsx', '.csv'].includes(ext)) return '스프레드시트';
        return '기타';
      });
      
      const missingTypes = requiredTypes.filter(type => !submittedTypes.includes(type as any));
      if (missingTypes.length > 0) {
        issues.push(`누락된 증빙 유형: ${missingTypes.join(', ')}`);
      } else {
        issues.push('제출된 증빙의 유형이 요구사항과 맞지 않습니다');
      }
      validationScore -= 15; // 기존 25에서 15로 완화
      severity = severity === 'low' ? 'medium' : severity;
    } else {
      issues.push('증빙 유형을 개선해주세요');
      validationScore -= 8;
      severity = severity === 'low' ? 'low' : severity;
    }
    recommendations.push('요구사항에 맞는 적절한 증빙 유형을 제출해주세요');
  }

  // 3. 증빙 완성도 검증 (유연한 기준 적용)
  const completenessResult = checkEvidenceCompletenessFlexible(submittedFiles, resultText);
  if (!completenessResult.isComplete) {
    if (completenessResult.severity === 'high') {
      if (submittedFiles.length === 0) {
        issues.push('증빙 파일이 제출되지 않았습니다');
      } else if (resultText.length < 30) { // 기존 50에서 30으로 완화
        issues.push('이행현황 내용이 부족합니다');
      } else {
        issues.push('증빙이 불완전하거나 내용이 부족합니다');
      }
      validationScore -= 15; // 기존 20에서 15로 완화
      severity = severity === 'low' ? 'medium' : severity;
    } else {
      issues.push('증빙 내용을 더 구체적으로 작성해주세요');
      validationScore -= 8;
      severity = severity === 'low' ? 'low' : severity;
    }
    recommendations.push('구체적이고 완전한 증빙 내용을 제출해주세요');
  }

  // 4. 샘플/테스트 증빙 감지 (경고 수준으로 완화)
  const hasSampleContent = detectSampleEvidence(submittedFiles, resultText);
  if (hasSampleContent) {
    issues.push('샘플 또는 테스트용 증빙이 감지되었습니다');
    validationScore -= 20; // 기존 40에서 20으로 완화
    severity = 'high';
    recommendations.push('실제 이행 현황에 대한 진짜 증빙을 제출해주세요');
  }

  // 5. 빈 증빙 감지 (경고 수준으로 완화)
  const hasEmptyEvidence = detectEmptyEvidence(submittedFiles, resultText);
  if (hasEmptyEvidence) {
    issues.push('빈 증빙 또는 내용이 없는 파일이 감지되었습니다');
    validationScore -= 15; // 기존 35에서 15로 완화
    severity = severity === 'low' ? 'medium' : severity;
    recommendations.push('실제 내용이 포함된 증빙을 제출해주세요');
  }

  // 6. 진행 가능 여부 결정 (더 유연한 기준)
  // critical: 샘플/테스트 증빙만 차단
  // high: 50점 미만일 때만 차단
  // medium/low: 항상 진행 허용
  if (hasSampleContent) {
    canProceed = false;
    severity = 'critical';
  } else if (validationScore < 50) {
    canProceed = false;
    severity = 'high';
  } else {
    canProceed = true;
  }

  return {
    isRelevant: relevanceResult.isRelevant,
    isAppropriate: appropriatenessResult.isAppropriate,
    isComplete: completenessResult.isComplete,
    validationScore: Math.max(0, validationScore),
    issues,
    recommendations,
    severity,
    canProceed
  };
}

// 증빙 관련성 검증 (유연한 버전)
function checkEvidenceRelevanceFlexible(
  requiredEvidence: string,
  submittedFiles: string[],
  resultText: string
): {
  isRelevant: boolean;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
} {
  // 필요증빙에서 요구하는 키워드 추출
  const requiredKeywords = extractRequiredKeywords(requiredEvidence);
  
  // 이행현황 텍스트에서 관련 키워드 확인
  const resultTextLower = resultText.toLowerCase();
  const contentMatches = requiredKeywords.filter(keyword => 
    resultTextLower.includes(keyword.toLowerCase())
  );

  // 제출된 파일명에서 관련 키워드 확인
  const fileMatches = submittedFiles.filter(file => {
    const fileName = file.toLowerCase();
    return requiredKeywords.some(keyword => 
      fileName.includes(keyword.toLowerCase())
    );
  });

  const hasRelevantContent = contentMatches.length > 0;
  const hasRelevantFiles = fileMatches.length > 0;
  
  // 신뢰도 계산
  const totalKeywords = requiredKeywords.length;
  const matchedKeywords = new Set([...contentMatches, ...fileMatches]).size;
  const confidence = totalKeywords > 0 ? (matchedKeywords / totalKeywords) * 100 : 0;
  
  // 심각도 결정
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (confidence < 30) {
    severity = 'high';
  } else if (confidence < 60) {
    severity = 'medium';
  }
  
  // 관련성 판단 (더 유연한 기준)
  const isRelevant = hasRelevantContent || hasRelevantFiles || confidence > 20;
  
  return {
    isRelevant,
    severity,
    confidence
  };
}

// 증빙 관련성 검증 (기존 버전 - 호환성 유지)
function checkEvidenceRelevance(
  requiredEvidence: string,
  submittedFiles: string[],
  resultText: string
): boolean {
  const result = checkEvidenceRelevanceFlexible(requiredEvidence, submittedFiles, resultText);
  return result.isRelevant;
}

// 증빙 적절성 검증 (유연한 버전)
function checkEvidenceAppropriatenessFlexible(
  requiredEvidence: string,
  submittedFiles: string[]
): {
  isAppropriate: boolean;
  severity: 'low' | 'medium' | 'high';
  matchRate: number;
} {
  const requiredTypes = extractRequiredEvidenceTypes(requiredEvidence);
  const submittedTypes = submittedFiles.map(file => {
    const ext = path.extname(file).toLowerCase();
    if (['.pdf', '.doc', '.docx', '.hwp'].includes(ext)) return '문서' as const;
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return '이미지' as const;
    if (['.xls', '.xlsx', '.csv'].includes(ext)) return '스프레드시트' as const;
    return '기타' as const;
  });

  // 매칭률 계산
  const matchedTypes = requiredTypes.filter(type => submittedTypes.includes(type as any));
  const matchRate = requiredTypes.length > 0 ? (matchedTypes.length / requiredTypes.length) * 100 : 100;
  
  // 심각도 결정
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (matchRate < 30) {
    severity = 'high';
  } else if (matchRate < 60) {
    severity = 'medium';
  }
  
  // 적절성 판단 (더 유연한 기준)
  const isAppropriate = matchRate > 20 || submittedTypes.length > 0;
  
  return {
    isAppropriate,
    severity,
    matchRate
  };
}

// 증빙 적절성 검증 (기존 버전 - 호환성 유지)
function checkEvidenceAppropriateness(
  requiredEvidence: string,
  submittedFiles: string[]
): boolean {
  const result = checkEvidenceAppropriatenessFlexible(requiredEvidence, submittedFiles);
  return result.isAppropriate;
}

// 증빙 완성도 검증 (유연한 버전)
function checkEvidenceCompletenessFlexible(
  submittedFiles: string[],
  resultText: string
): {
  isComplete: boolean;
  severity: 'low' | 'medium' | 'high';
  completenessScore: number;
} {
  // 파일 존재 여부
  const hasFiles = submittedFiles && submittedFiles.length > 0;
  
  // 텍스트 내용 품질 평가
  const textLength = resultText.length;
  const isMeaningless = isMeaninglessText(resultText);
  const hasDetailedContent = textLength > 30 && !isMeaningless; // 기존 50에서 30으로 완화
  
  // 완성도 점수 계산
  let completenessScore = 0;
  if (hasFiles) completenessScore += 50;
  if (hasDetailedContent) completenessScore += 40;
  if (textLength > 100) completenessScore += 10; // 추가 보너스
  
  // 심각도 결정
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (completenessScore < 30) {
    severity = 'high';
  } else if (completenessScore < 60) {
    severity = 'medium';
  }
  
  // 완성도 판단 (더 유연한 기준)
  const isComplete = completenessScore > 40 || (hasFiles && textLength > 20);
  
  return {
    isComplete,
    severity,
    completenessScore
  };
}

// 증빙 완성도 검증 (기존 버전 - 호환성 유지)
function checkEvidenceCompleteness(
  submittedFiles: string[],
  resultText: string
): boolean {
  const result = checkEvidenceCompletenessFlexible(submittedFiles, resultText);
  return result.isComplete;
}

// 샘플/테스트 증빙 감지
function detectSampleEvidence(
  submittedFiles: string[],
  resultText: string
): boolean {
  const sampleKeywords = [
    '샘플', 'sample', '예시', 'example', '테스트', 'test',
    '더미', 'dummy', '가짜', 'fake', '임시', 'temporary',
    'xxx', 'aaa', '123', 'test123', 'sample123'
  ];

  const textLower = resultText.toLowerCase();
  const hasSampleText = sampleKeywords.some(keyword => 
    textLower.includes(keyword)
  );

  const hasSampleFiles = submittedFiles.some(file => {
    const fileName = file.toLowerCase();
    return sampleKeywords.some(keyword => 
      fileName.includes(keyword)
    );
  });

  return hasSampleText || hasSampleFiles;
}

// 빈 증빙 감지
function detectEmptyEvidence(
  submittedFiles: string[],
  resultText: string
): boolean {
  // 이행현황이 너무 짧거나 의미없는 경우
  const isTextEmpty = resultText.length < 20 || isMeaninglessText(resultText);
  
  // 파일이 없거나 빈 파일명
  const hasEmptyFiles = !submittedFiles || submittedFiles.length === 0 ||
    submittedFiles.some(file => !file || file.trim() === '');

  return isTextEmpty || hasEmptyFiles;
}

// 필요증빙에서 키워드 추출
function extractRequiredKeywords(requiredEvidence: string): string[] {
  const keywords = [];
  const text = requiredEvidence.toLowerCase();
  
  if (text.includes('서류') || text.includes('문서')) keywords.push('서류', '문서');
  if (text.includes('화면') || text.includes('캡처')) keywords.push('화면', '캡처');
  if (text.includes('로그') || text.includes('기록')) keywords.push('로그', '기록');
  if (text.includes('계획') || text.includes('정책')) keywords.push('계획', '정책');
  if (text.includes('교육') || text.includes('훈련')) keywords.push('교육', '훈련');
  if (text.includes('보고') || text.includes('점검')) keywords.push('보고', '점검');
  
  return keywords;
}

// 필요증빙에서 요구하는 증빙 유형 추출
function extractRequiredEvidenceTypes(requiredEvidence: string): string[] {
  const types = [];
  const text = requiredEvidence.toLowerCase();
  
  if (text.includes('서류') || text.includes('문서') || text.includes('보고서')) {
    types.push('문서');
  }
  if (text.includes('화면') || text.includes('캡처') || text.includes('스크린샷')) {
    types.push('이미지');
  }
  if (text.includes('로그') || text.includes('기록')) {
    types.push('로그');
  }
  
  return types;
}

// 의미없는 텍스트 감지 (기존 함수 재사용)
function isMeaninglessText(input: string): boolean {
  const trimmed = input.trim();
  
  if (!trimmed) return true;
  if (trimmed.length <= 10) return true;
  if (/^\d{3,}$/.test(trimmed)) return true;
  if (/^[^\w가-힣\s]{3,}$/.test(trimmed)) return true;
  
  const keyboardPatterns = /^(asdf|qwer|zxcv|hjkl|uiop|nm,\.|asd|qwe|zxc|jkl|uio|nm,)$/i;
  if (keyboardPatterns.test(trimmed)) return true;
  
  if (/^(.)\1{3,}$/.test(trimmed)) return true;
  
  const testPatterns = /^(test|테스트|test\d+|테스트\d+|testing|테스팅)$/i;
  if (testPatterns.test(trimmed)) return true;
  
  if (/^(abc|def|ghi|jkl|mno|pqr|stu|vwx|yz|123|456|789|012|345|678|901)$/i.test(trimmed)) return true;
  
  if (/^[ㄱ-ㅎㅏ-ㅣ]{3,}$/.test(trimmed)) return true;
  
  return false;
}

// 증빙 적절성 검증을 위한 AI 스키마 정의
const evidenceValidationSchema = {
  type: 'object',
  properties: {
    isAppropriate: {
      type: 'boolean',
      description: '제출된 증빙이 요구사항에 적절한지 여부',
    },
    issues: {
      type: 'array',
      description: '증빙이 부적절한 경우 발견된 문제점 목록',
      items: {
        type: 'string',
      },
    },
    reasons: {
      type: 'array',
      description: '부적절한 사유 (각 사유는 구체적으로 작성)',
      items: {
        type: 'string',
      },
    },
    severity: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: '문제의 심각도. critical: 평가 불가, high: 중대한 문제, medium: 보통 문제, low: 경미한 문제',
    },
    recommendations: {
      type: 'array',
      description: '증빙 개선을 위한 구체적인 권고사항',
      items: {
        type: 'string',
      },
    },
  },
  required: ['isAppropriate', 'issues', 'reasons', 'severity'],
};

// Gemini API를 사용한 증빙 적절성 검증 함수
async function validateEvidenceContentWithAI(
  requiredEvidence: string,
  submittedFiles: string[],
  resultText: string,
  fileAnalyses: FileAnalysisResult[],
  apiKey: string
): Promise<{
  isAppropriate: boolean;
  issues: string[];
  reasons: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  canProceed: boolean;
}> {
  // 파일 내용 추출
  const textAnalyses = fileAnalyses
    .filter(f => f.type === 'text')
    .map(f => f.content)
    .join('\n\n');

  const imageAnalyses = fileAnalyses.filter(f => f.type === 'image');

  // 증빙 적절성 검증을 위한 프롬프트
  const validationPrompt = `당신은 정보보호 평가 전문가입니다. 제출된 증빙이 체크리스트 항목의 요구사항에 적절한지 검증해주세요.

=== 체크리스트 항목 정보 ===
필요증빙: ${requiredEvidence}

=== 제출된 증빙 정보 ===
이행현황: ${resultText}
제출된 파일: ${submittedFiles.length > 0 ? submittedFiles.join(', ') : '없음'}
${textAnalyses ? `\n파일 내용:\n${textAnalyses}` : ''}

=== 검증 기준 ===
1. 관련성: 제출된 증빙이 체크리스트 항목과 직접적으로 관련되어 있는가?
2. 적절성: 필요증빙에서 요구하는 유형과 내용이 적절한가?
3. 완성도: 증빙 내용이 충분하고 구체적인가?
4. 진실성: 실제 이행 현황을 반영한 증빙인가? (샘플/테스트/더미 데이터가 아닌가?)
5. 유효성: 증빙이 요구사항을 충족하는 데 충분한가?

=== 판단 기준 ===
- critical: 샘플/테스트/더미 데이터이거나 전혀 관련이 없는 경우 → 평가 불가
- high: 증빙이 요구사항과 상당히 부합하지 않거나 중요 증빙이 누락된 경우 → 평가 중단 권장
- medium: 증빙이 부분적으로 적절하지만 개선이 필요한 경우 → 경고 후 평가 진행 가능
- low: 증빙이 대체로 적절하지만 일부 보완이 권장되는 경우 → 평가 진행 가능

=== 출력 형식 ===
다음 JSON 형식으로 응답해주세요:
{
  "isAppropriate": true/false,
  "issues": ["문제점1", "문제점2"],
  "reasons": ["구체적인 부적절 사유1", "구체적인 부적절 사유2"],
  "severity": "critical|high|medium|low",
  "recommendations": ["개선 권고사항1", "개선 권고사항2"]
}

중요: JSON 형식으로만 응답하고 다른 설명은 포함하지 마세요.`;

  const MAX_RETRIES = 3;
  let attempt = 0;
  let response: any = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    console.log(`증빙 적절성 검증 API 요청 시도 #${attempt}`);

    try {
      // API 요청 본문 구성
      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: validationPrompt
              },
              ...imageAnalyses.map(img => ({
                inlineData: {
                  mimeType: img.mimeType,
                  data: img.content
                }
              }))
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.1,
          topP: 0.9,
          topK: 50,
          responseMimeType: 'application/json',
          responseSchema: evidenceValidationSchema
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      // 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1분 타임아웃

      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 5xx 에러인 경우 재시도
      if (response.status >= 500 && response.status < 600) {
        console.warn(`증빙 검증 API가 ${response.status} 에러를 반환했습니다. 재시도합니다...`);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }

      if (response.ok) {
        break;
      }

    } catch (error) {
      console.error(`증빙 검증 API 요청 중 네트워크 오류 발생 (시도 #${attempt}):`, error);
      if (attempt >= MAX_RETRIES) {
        throw new Error('증빙 검증 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!response || !response.ok) {
    throw new Error('증빙 검증 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }

  const data = await response.json();

  // API 응답 구조 안전하게 처리
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
    throw new Error('증빙 검증 시스템 응답 구조가 올바르지 않습니다.');
  }

  let validationResult;
  try {
    // JSON 응답 파싱
    const content = data.candidates[0].content.parts[0].text;
    let jsonContent = content.trim();

    // JSON 시작과 끝 찾기
    const startIndex = jsonContent.indexOf('{');
    const lastIndex = jsonContent.lastIndexOf('}');

    if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
      jsonContent = jsonContent.substring(startIndex, lastIndex + 1);
    }

    validationResult = JSON.parse(jsonContent);

    // 필수 필드 검증 및 기본값 설정
    if (typeof validationResult.isAppropriate !== 'boolean') {
      validationResult.isAppropriate = false;
    }
    if (!Array.isArray(validationResult.issues)) {
      validationResult.issues = [];
    }
    if (!Array.isArray(validationResult.reasons)) {
      validationResult.reasons = validationResult.issues.length > 0 ? validationResult.issues : ['증빙 검증 중 오류가 발생했습니다.'];
    }
    if (!['low', 'medium', 'high', 'critical'].includes(validationResult.severity)) {
      validationResult.severity = validationResult.isAppropriate ? 'low' : 'high';
    }
    if (!Array.isArray(validationResult.recommendations)) {
      validationResult.recommendations = [];
    }

  } catch (parseError) {
    console.error('증빙 검증 응답 JSON 파싱 오류:', parseError);
    // 기본 응답 생성
    validationResult = {
      isAppropriate: false,
      issues: ['증빙 검증 중 오류가 발생했습니다.'],
      reasons: ['증빙 검증 시스템 응답을 처리할 수 없습니다.'],
      severity: 'high' as const,
      recommendations: ['잠시 후 다시 시도해주세요.']
    };
  }

  // 진행 가능 여부 결정
  const canProceed = validationResult.isAppropriate || 
    (validationResult.severity === 'low' || validationResult.severity === 'medium');

  return {
    ...validationResult,
    canProceed
  };
}

// 증빙 안내 메시지 생성 함수 (개선된 버전)
function generateEvidenceGuidance(
  evidenceValidation: {
    isRelevant: boolean;
    isAppropriate: boolean;
    isComplete: boolean;
    validationScore: number;
    issues: string[];
    recommendations: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
    canProceed?: boolean;
  },
  requiredEvidence: string
): string {
  let guidance = '';
  const severity = evidenceValidation.severity || 'medium';
  
  // 심각도에 따른 메시지 톤 조정
  if (severity === 'critical') {
    guidance += '🚫 심각한 증빙 문제가 감지되었습니다\n\n';
  } else if (severity === 'high') {
    guidance += '⚠️ 증빙 검증 실패\n\n';
  } else if (severity === 'medium') {
    guidance += '⚠️ 증빙 개선이 필요합니다\n\n';
  } else {
    guidance += '💡 증빙 개선 제안\n\n';
  }
  
  // 핵심 문제점을 우선순위에 따라 표시
  const criticalIssues = evidenceValidation.issues.filter(issue => 
    issue.includes('샘플') || issue.includes('테스트') || issue.includes('빈')
  );
  
  const importantIssues = evidenceValidation.issues.filter(issue => 
    issue.includes('관련성') || issue.includes('유형') || issue.includes('누락')
  );
  
  const minorIssues = evidenceValidation.issues.filter(issue => 
    !criticalIssues.includes(issue) && !importantIssues.includes(issue)
  );
  
  // 심각한 문제부터 표시
  criticalIssues.forEach(issue => {
    guidance += `• ${issue}\n`;
  });
  
  importantIssues.forEach(issue => {
    guidance += `• ${issue}\n`;
  });
  
  minorIssues.forEach(issue => {
    guidance += `• ${issue}\n`;
  });
  
  // 구체적인 해결 방안 제시
  if (evidenceValidation.recommendations.length > 0) {
    guidance += '\n📋 개선 방안:\n';
    evidenceValidation.recommendations.forEach(rec => {
      guidance += `• ${rec}\n`;
    });
  }
  
  // 요구되는 증빙 유형 안내
  if (!evidenceValidation.isAppropriate) {
    const requiredTypes = extractRequiredEvidenceTypes(requiredEvidence);
    if (requiredTypes.length > 0) {
      guidance += `\n📄 요구되는 증빙 유형: ${requiredTypes.join(', ')}\n`;
    }
  }
  
  // HWP 파일 관련 안내 추가
  const hasHwpFiles = evidenceValidation.issues.some(issue => 
    issue.includes('수동평가') || issue.includes('HWP')
  );
  
  if (hasHwpFiles) {
    guidance += '\n\n📄 HWP 파일 안내:\n• HWP 파일은 수동평가 대상으로 분류됩니다.\n• 자동 분석이 불가능하여 파일명과 크기만 참고됩니다.\n• 정확한 평가를 위해서는 PDF로 변환 후 업로드해주세요.';
  }
  
  // 마무리 메시지
  if (severity === 'critical') {
    guidance += '\n실제 이행 현황에 대한 진짜 증빙을 제출한 후 다시 평가해주세요.';
  } else if (severity === 'high') {
    guidance += '\n적절한 증빙을 제출한 후 다시 평가해주세요.';
  } else {
    guidance += '\n증빙을 개선하여 더 나은 평가 결과를 받으실 수 있습니다.';
  }
  
  return guidance;
}

// 파일 크기 제한 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 텍스트 청크 분할 함수
function chunkText(text: string, maxChunkSize: number = 8000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // 문장 경계에서 자르기
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const cutPoint = Math.max(lastPeriod, lastNewline);
      
      if (cutPoint > start) {
        end = cutPoint + 1;
      }
    }
    
    chunks.push(text.slice(start, end));
    start = end;
  }
  
  return chunks;
}

// 파일 분석 함수 수정: 분석 결과를 일관된 객체 형태로 반환
async function analyzeFile(filePath: string): Promise<FileAnalysisResult> {
  const fullPath = path.join(process.cwd(), 'public', filePath);
  const fileName = path.basename(filePath);

  if (!fs.existsSync(fullPath)) {
    return { type: 'text', content: `[파일 없음: ${fileName}]`, fileName };
  }

  const fileExtension = path.extname(filePath).toLowerCase();
  const fileStats = fs.statSync(fullPath);
  const fileSize = (fileStats.size / 1024).toFixed(2);
  
  // 파일 크기 제한 확인
  if (fileStats.size > MAX_FILE_SIZE) {
    return { 
      type: 'text', 
      content: `[파일 크기 초과: ${fileName} (${fileSize} KB)]\n파일이 너무 커서 분석할 수 없습니다. 10MB 이하의 파일을 업로드해주세요.`, 
      fileName 
    };
  }

  // 이미지 파일인 경우
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  if (imageExtensions.includes(fileExtension)) {
    const dataBuffer = fs.readFileSync(fullPath);
    const base64Content = dataBuffer.toString('base64');
    const mimeType = getMimeType(filePath);
    return {
      type: 'image',
      content: base64Content,
      mimeType,
      fileName,
    };
  }
  
  // PDF 파일인 경우
  if (fileExtension === '.pdf') {
    try {
      const dataBuffer = fs.readFileSync(fullPath);
      const data = await pdf(dataBuffer);
      
      // 대용량 PDF 파일 청크 처리
      if (data.text.length > 15000) {
        const chunks = chunkText(data.text, 8000);
        const summary = `[대용량 PDF 파일: ${fileName} (${fileSize} KB, ${data.numpages} 페이지, ${chunks.length}개 청크)]\n파일이 너무 커서 요약된 내용만 분석됩니다.\n\n`;
        const chunkContent = chunks.slice(0, 2).join('\n\n[중간 생략]\n\n'); // 처음 2개 청크만 사용
        return { type: 'text', content: summary + chunkContent, fileName };
      }
      
      return { type: 'text', content: `[PDF 분석: ${fileName} (${fileSize} KB, ${data.numpages} 페이지)]\n${data.text}`, fileName };
    } catch (pdfError) {
      console.error('PDF 분석 오류:', pdfError);
      return { type: 'text', content: `[PDF 분석 실패: ${fileName}]`, fileName };
    }
  }
  
  // 텍스트 기반 파일인 경우
  if (['.txt', '.md', '.json', '.csv'].includes(fileExtension)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // 대용량 텍스트 파일 청크 처리
    if (content.length > 15000) {
      const chunks = chunkText(content, 8000);
      const summary = `[대용량 텍스트 파일: ${fileName} (${fileSize} KB, ${chunks.length}개 청크)]\n파일이 너무 커서 요약된 내용만 분석됩니다.\n\n`;
      const chunkContent = chunks.slice(0, 2).join('\n\n[중간 생략]\n\n'); // 처음 2개 청크만 사용
      return { type: 'text', content: summary + chunkContent, fileName };
    }
    
    return { type: 'text', content: `[텍스트 파일 분석: ${fileName} (${fileSize} KB)]\n${content}`, fileName };
  }
  
  // HWP 파일인 경우 (수동평가 대상)
  if (fileExtension === '.hwp') {
    return { 
      type: 'text', 
      content: `[수동평가 대상: ${fileName} (${fileSize} KB)]\n\n📋 HWP 파일 안내:\n- 파일명: ${fileName}\n- 파일 크기: ${fileSize} KB\n- 문서 유형: 한글 문서 (HWP)\n- 평가 방식: 수동평가 대상\n\n⚠️ 중요 안내:\nHWP 파일은 자동 분석이 불가능하여 수동평가 대상으로 분류됩니다.\n\n📄 PDF 변환 방법:\n1. 한글과컴퓨터 한글 프로그램에서 파일 열기\n2. "파일" → "PDF로 내보내기" 선택\n3. 변환된 PDF 파일을 다시 업로드\n\n💡 PDF 변환 후 업로드하시면 자동 분석이 가능합니다.`, 
      fileName 
    };
  }
  
  // 기타 지원하지 않는 파일
  return { type: 'text', content: `[지원하지 않는 파일: ${fileName}, 형식: ${fileExtension}]`, fileName };
}

// AI 응답을 위한 JSON 스키마 정의
const evaluationSchema = {
  type: 'object',
  properties: {
    complianceRate: {
      type: 'integer',
      description: '0-100 사이의 준수율 점수. 모든 규칙을 엄격하게 적용하여 산정.',
    },
    filesConsidered: {
      type: 'boolean',
      description: '첨부파일 내용을 평가에 고려했는지 여부. 내용이 있으면 true, 없거나 분석 못했으면 false.',
    },
    evaluationBasis: {
      type: 'array',
      description: '평가방법의 각 항목에 대한 평가 근거 목록.',
      items: {
        type: 'object',
        properties: {
          criterion: {
            type: 'string',
            description: '평가된 기준 항목 (평가방법의 원문 문장).',
          },
          satisfied: {
            type: 'boolean',
            description: '해당 기준을 충족했는지 여부.',
          },
          reason: {
            type: 'string',
            description: '충족 또는 부족에 대한 구체적인 이유.',
          },
          type: {
            type: 'string',
            enum: ['필수', '권고'],
            description: '해당 기준의 중요도. 준수율에 영향을 미치는 핵심 사항은 "필수".',
          }
        },
        required: ['criterion', 'satisfied', 'reason', 'type'],
      },
    },
    improvementSuggestions: {
      type: 'array',
      description: '개선이 필요한 "필수" 항목에 대한 구체적인 제안 목록. 각 제안은 30자 이내.',
      items: {
        type: 'string',
      },
    },
    summary: {
      type: 'string',
      description: '평가 결과에 대한 전반적인 한 줄 요약.',
    }
  },
  required: ['complianceRate', 'filesConsidered', 'evaluationBasis', 'improvementSuggestions', 'summary'],
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { evaluationMethod, requiredEvidence, resultText, resultFiles, implementationStatus } = req.body;

    if (!evaluationMethod || !requiredEvidence || !resultText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 증빙 필수 여부 판단
    const needsEvidence = requiresEvidence(requiredEvidence);
    
    // 증빙 충족도 평가
    const evidenceEvaluation = evaluateEvidenceCompliance(
      requiredEvidence, 
      resultFiles || [], 
      resultText
    );

    // 증빙 내용 적절성 검증 (사전 필터링용 - 빠른 차단)
    const evidenceValidation = validateEvidenceContent(
      requiredEvidence,
      resultFiles || [],
      resultText,
      evaluationMethod
    );

    console.log('증빙 분석 결과 (사전 검증):', {
      needsEvidence,
      evidenceEvaluation,
      evidenceValidation
    });

    // 사전 필터링: 명확히 차단해야 하는 경우만 빠르게 차단
    if (evidenceValidation.severity === 'critical') {
      const guidanceMessage = generateEvidenceGuidance(evidenceValidation, requiredEvidence);
      return res.status(200).json({
        progress: 0,
        improvement: '',
        basis: '',
        rawResponse: null,
        evidenceAnalysis: {
          needsEvidence,
          evidenceEvaluation,
          evidenceValidation,
          evidenceImpact: '샘플/테스트 증빙으로 인한 평가 불가',
          guidance: guidanceMessage
        }
      });
    }

    // API 키 확인
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('시스템 설정에 문제가 있습니다. 관리자에게 문의해주세요.');
    }

    // 파일 분석 실행 (AI 검증을 위해 필요)
    const fileAnalyses: FileAnalysisResult[] = resultFiles && resultFiles.length > 0
      ? await Promise.all(resultFiles.map(analyzeFile))
      : [];

    // Gemini API를 사용한 증빙 적절성 검증 (파일 내용 기반)
    console.log('증빙 적절성 AI 검증 시작...');
    let aiValidationResult;
    try {
      aiValidationResult = await validateEvidenceContentWithAI(
        requiredEvidence,
        resultFiles || [],
        resultText,
        fileAnalyses,
        apiKey
      );

      console.log('증빙 적절성 AI 검증 결과:', aiValidationResult);

      // AI 검증 결과에 따라 평가 진행 여부 결정
      if (!aiValidationResult.canProceed) {
        // 부적절한 증빙: 사유와 함께 평가 중단
        const guidanceMessage = `🚫 증빙 검증 실패\n\n제출된 증빙이 요구사항에 적절하지 않아 평가를 진행할 수 없습니다.\n\n📋 발견된 문제점:\n${aiValidationResult.issues.map(issue => `• ${issue}`).join('\n')}\n\n❌ 부적절한 사유:\n${aiValidationResult.reasons.map(reason => `• ${reason}`).join('\n')}\n\n💡 개선 권고사항:\n${aiValidationResult.recommendations.map(rec => `• ${rec}`).join('\n')}`;

        return res.status(200).json({
          progress: 0,
          improvement: '',
          basis: '',
          rawResponse: null,
          evidenceAnalysis: {
            needsEvidence,
            evidenceEvaluation,
            evidenceValidation: {
              ...evidenceValidation,
              // AI 검증 결과 병합
              isAppropriate: aiValidationResult.isAppropriate,
              issues: [...evidenceValidation.issues, ...aiValidationResult.issues],
              reasons: aiValidationResult.reasons,
              severity: aiValidationResult.severity,
              recommendations: [...evidenceValidation.recommendations, ...aiValidationResult.recommendations],
              canProceed: false
            },
            evidenceImpact: aiValidationResult.severity === 'critical' ? 
              '증빙이 부적절하여 평가 불가 (AI 검증)' : 
              '증빙이 부적절하여 평가 중단 (AI 검증)',
            guidance: guidanceMessage
          }
        });
      }

      console.log('증빙 적절성 검증 통과. 최종 평가 진행...');

    } catch (error) {
      console.error('증빙 적절성 AI 검증 중 오류:', error);
      // AI 검증 실패 시 기존 로직으로 폴백
      if (!evidenceValidation.canProceed) {
        const guidanceMessage = generateEvidenceGuidance(evidenceValidation, requiredEvidence);
        return res.status(200).json({
          progress: 0,
          improvement: '',
          basis: '',
          rawResponse: null,
          evidenceAnalysis: {
            needsEvidence,
            evidenceEvaluation,
            evidenceValidation,
            evidenceImpact: '증빙 부적절로 인한 평가 불가',
            guidance: guidanceMessage
          }
        });
      }
      // 검증은 통과했으므로 최종 평가 진행 (오류 로그만 기록)
      console.warn('증빙 AI 검증 실패했으나 기존 검증 통과로 최종 평가 진행');
    }

    const textAnalyses = fileAnalyses
      .filter(f => f.type === 'text')
      .map(f => f.content)
      .join('\n\n');

    const imageAnalyses = fileAnalyses.filter(f => f.type === 'image');

    const promptText = `평가방법 기준으로 준수율 산출:

평가방법: ${evaluationMethod}
이행현황: ${resultText}
첨부파일: ${textAnalyses || '없음'}

점수: 90-100(완벽), 80-89(대부분), 70-79(기본), 60-69(일부), 50-59(거의미충족), 0-49(전혀미충족)
HWP는 수동평가(파일명/크기만 참고)

JSON응답:
{"complianceRate": 0-100, "evaluationBasis": [{"criterion": "기준", "satisfied": true/false, "type": "필수", "reason": "사유"}], "improvementPlan": [{"item": "개선항목", "action": "방안"}]}`;

    /* 
    // Perplexity API용 멀티모달 메시지 구성 (주석 처리 - 필요시 사용)
    const messages: any[] = [{
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        ...imageAnalyses.map(img => ({
          type: 'image_url',
          image_url: {
            url: `data:${img.mimeType};base64,${img.content}`
          }
        }))
      ]
    }];
    */

    // 최종 평가 API 호출 (API 키는 이미 확인됨)
    const MAX_RETRIES = 3;
    let attempt = 0;
    let response: any = null;

    while (attempt < MAX_RETRIES) {
      attempt++;
      console.log(`API 요청 시도 #${attempt}`);
      
      try {
        // API 요청 본문 구성
        const requestBody: any = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: promptText
                },
                ...imageAnalyses.map(img => ({
                  inlineData: {
                    mimeType: img.mimeType,
                    data: img.content
                  }
                }))
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 8192,  // 대용량 파일 처리용 토큰 수 증가
            temperature: 0.1,
            topP: 0.9,  // 응답 품질 향상
            topK: 50    // 응답 다양성 증가
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        };

        // AbortController를 사용한 타임아웃 설정 (대용량 파일 처리 고려)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2분 타임아웃
        
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        // 5xx 에러인 경우 재시도
        if (response.status >= 500 && response.status < 600) {
          console.warn(`API가 ${response.status} 에러를 반환했습니다. 재시도합니다...`);
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
            continue;
          }
        }
        
        // 요청이 성공적으로 처리되었으면 루프 종료
        if (response.ok) {
          break;
        }

      } catch (error) {
        console.error(`API 요청 중 네트워크 오류 발생 (시도 #${attempt}):`, error);
        if (attempt >= MAX_RETRIES) {
          throw new Error('네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.'); // 모든 재시도 실패 시 최종 에러 throw
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
      }
    }

    if (!response) {
      throw new Error('평가 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    const data = await response.json();
    
    // API 응답 구조 안전하게 처리
    console.log('API Raw Response Data:', JSON.stringify(data, null, 2)); // 디버깅용
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      // MAX_TOKENS 오류인 경우 특별 처리
      if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'MAX_TOKENS') {
        throw new Error('평가 내용이 너무 길어서 처리할 수 없습니다. 이행현황을 더 간결하게 작성해주세요.');
      }
      
      throw new Error('평가 시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    const content = data.candidates[0].content.parts[0].text;

    console.log('API Raw Response Content:', content); // 디버깅을 위해 AI 원본 응답 기록

    let evaluationResult;
    try {
      // AI 응답에서 JSON 부분 추출 시도
      let jsonContent = content.trim();
      
      // JSON 시작과 끝 찾기
      const startIndex = jsonContent.indexOf('{');
      const lastIndex = jsonContent.lastIndexOf('}');
      
      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        jsonContent = jsonContent.substring(startIndex, lastIndex + 1);
      }
      
      // 불완전한 JSON 수정 시도
      if (!jsonContent.endsWith('}')) {
        // 마지막 부분이 불완전한 경우 기본 구조로 완성
        if (jsonContent.includes('"complianceRate"') && !jsonContent.includes('"improvementPlan"')) {
          jsonContent += ',"improvementPlan":[]}';
        } else if (jsonContent.includes('"evaluationBasis"') && !jsonContent.includes('"complianceRate"')) {
          jsonContent += ',"complianceRate":0,"improvementPlan":[]}';
        } else {
          jsonContent += '}';
        }
      }
      
      evaluationResult = JSON.parse(jsonContent);
      
      // 필수 필드 검증 및 기본값 설정
      if (!evaluationResult.complianceRate && evaluationResult.complianceRate !== 0) {
        evaluationResult.complianceRate = 0;
      }
      if (!evaluationResult.evaluationBasis) {
        evaluationResult.evaluationBasis = [];
      }
      if (!evaluationResult.improvementPlan) {
        evaluationResult.improvementPlan = [];
      }
      
    } catch (parseError) {
      console.error('AI 응답 JSON 파싱 오류:', parseError);
      console.error('파싱 실패한 원본 내용:', content);
      
      // 기본 응답 생성
      evaluationResult = {
        complianceRate: 0,
        evaluationBasis: [{
          criterion: "평가 시스템 오류",
          satisfied: false,
          type: "필수",
          reason: "평가 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
        }],
        improvementPlan: [{
          item: "시스템 문제",
          action: "잠시 후 다시 시도하거나, 이행현황을 더 간결하게 작성해주세요."
        }]
      };
    }
    
    // --- 최종 결과 재구성 로직 ---
    const hasRequiredFailure = evaluationResult.evaluationBasis.some((item: any) => !item.satisfied && item.type === '필수');

    let improvement = '';

    // improvementPlan이 있는 경우 우선 사용
    if (evaluationResult.improvementPlan && evaluationResult.improvementPlan.length > 0) {
      improvement = evaluationResult.improvementPlan.map((item: any) => 
        `• ${item.item}\n  ${item.action}`
      ).join('\n\n');
    } else if (hasRequiredFailure) {
      // 필수 항목 부족 시, AI가 제안한 개선안이 있다면 사용하고, 없다면 기본 메시지 사용
      if (evaluationResult.improvementSuggestions && evaluationResult.improvementSuggestions.length > 0) {
        improvement = evaluationResult.improvementSuggestions.map((item: string) => `• ${item}`).join('\n');
      } else {
        improvement = '• 평가 결과를 확인하고 부족한 부분을 개선해주세요.';
      }
    } else {
      // 점수에 따른 상태 분류
      if (evaluationResult.complianceRate === 100) {
        improvement = '모든 기준을 완벽하게 충족하여 추가 개선사항 없음';
      } else if (evaluationResult.complianceRate >= 90) {
        improvement = '거의 모든 기준을 충족했습니다. 세부 개선사항을 확인해주세요.';
      } else if (evaluationResult.complianceRate >= 80) {
        improvement = '대부분의 기준을 충족했습니다. 일부 개선이 필요합니다.';
      } else if (evaluationResult.complianceRate >= 70) {
        improvement = '기본 기준은 충족했으나 상당한 개선이 필요합니다.';
      } else if (evaluationResult.complianceRate >= 60) {
        improvement = '일부 기준만 충족했습니다. 많은 개선이 필요합니다.';
      } else if (evaluationResult.complianceRate >= 50) {
        improvement = '기준을 거의 충족하지 못했습니다. 대폭적인 개선이 필요합니다.';
      } else {
        improvement = '기준을 전혀 충족하지 못했습니다. 전면적인 재검토가 필요합니다.';
      }
      
      // AI가 제안한 개선사항이 있으면 추가
      if (evaluationResult.improvementSuggestions && evaluationResult.improvementSuggestions.length > 0) {
        improvement += '\n\n구체적인 개선사항:\n' + evaluationResult.improvementSuggestions.map((item: string) => `• ${item}`).join('\n');
      }
    }
    
    // 평가 근거(basis)를 프론트엔드에서 사용하기 좋은 문자열 형태로 변환
    const basis = evaluationResult.evaluationBasis.map((item: any) => 
      `${item.satisfied ? '✓ 충족' : '✗ 부족'} (${item.type}) ${item.criterion}\n  - 사유: ${item.reason}`
    ).join('\n');

    // 증빙 영향도 계산 (유연한 기준)
    let evidenceImpact = '증빙 기준 충족';
    if (needsEvidence && !evidenceEvaluation.hasEvidence) {
      evidenceImpact = '증빙 누락으로 인한 점수 조정';
    } else if (evidenceEvaluation.complianceScore < 50) {
      evidenceImpact = '증빙 품질 부족으로 인한 점수 조정';
    } else if (evidenceValidation.validationScore < 50) {
      evidenceImpact = '증빙 내용 검증 실패로 인한 점수 조정';
    } else if (evidenceValidation.severity === 'medium') {
      evidenceImpact = '증빙 개선 권장';
    } else if (evidenceValidation.severity === 'low') {
      evidenceImpact = '증빙 기준 충족';
    }

    res.status(200).json({
      progress: evaluationResult.complianceRate,
      improvement,
      basis,
      evidenceAnalysis: {
        needsEvidence,
        evidenceEvaluation,
        evidenceValidation,
        evidenceImpact,
        // 추가 정보 제공
        evidenceQuality: evidenceValidation.severity || 'low',
        canProceed: evidenceValidation.canProceed ?? true,
        recommendations: evidenceValidation.recommendations || []
      }
    });

  } catch (error) {
    console.error('Evaluation error:', error);
    
    // 사용자 친화적인 오류 메시지
    let userMessage = '평가 중 문제가 발생했습니다.';
    if (error instanceof Error) {
      if (error.message.includes('API 키')) {
        userMessage = '시스템 설정에 문제가 있습니다. 관리자에게 문의해주세요.';
      } else if (error.message.includes('네트워크')) {
        userMessage = '네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message.includes('토큰') || error.message.includes('길어서')) {
        userMessage = '입력 내용이 너무 깁니다. 이행현황을 더 간결하게 작성해주세요.';
      } else if (error.message.includes('일시적인')) {
        userMessage = error.message;
      }
    }
    
    res.status(500).json({ 
      error: userMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}