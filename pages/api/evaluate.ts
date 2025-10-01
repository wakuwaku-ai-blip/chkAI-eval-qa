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

// 증빙 내용 적절성 검증 함수
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
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let validationScore = 100;

  // 1. 증빙 관련성 검증
  const isRelevant = checkEvidenceRelevance(requiredEvidence, submittedFiles, resultText);
  if (!isRelevant) {
    issues.push('제출된 증빙이 체크리스트 항목과 관련성이 없습니다');
    validationScore -= 30;
    recommendations.push('체크리스트 항목과 직접적으로 관련된 증빙을 제출해주세요');
  }

  // 2. 증빙 적절성 검증
  const isAppropriate = checkEvidenceAppropriateness(requiredEvidence, submittedFiles);
  if (!isAppropriate) {
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
    validationScore -= 25;
    recommendations.push('요구사항에 맞는 적절한 증빙 유형을 제출해주세요');
  }

  // 3. 증빙 완성도 검증
  const isComplete = checkEvidenceCompleteness(submittedFiles, resultText);
  if (!isComplete) {
    if (submittedFiles.length === 0) {
      issues.push('증빙 파일이 제출되지 않았습니다');
    } else if (resultText.length < 50) {
      issues.push('이행현황 내용이 부족합니다');
    } else {
      issues.push('증빙이 불완전하거나 내용이 부족합니다');
    }
    validationScore -= 20;
    recommendations.push('구체적이고 완전한 증빙 내용을 제출해주세요');
  }

  // 4. 샘플/테스트 증빙 감지
  const hasSampleContent = detectSampleEvidence(submittedFiles, resultText);
  if (hasSampleContent) {
    issues.push('샘플 또는 테스트용 증빙이 감지되었습니다');
    validationScore -= 40;
    recommendations.push('실제 이행 현황에 대한 진짜 증빙을 제출해주세요');
  }

  // 5. 빈 증빙 감지
  const hasEmptyEvidence = detectEmptyEvidence(submittedFiles, resultText);
  if (hasEmptyEvidence) {
    issues.push('빈 증빙 또는 내용이 없는 파일이 감지되었습니다');
    validationScore -= 35;
    recommendations.push('실제 내용이 포함된 증빙을 제출해주세요');
  }

  return {
    isRelevant,
    isAppropriate,
    isComplete,
    validationScore: Math.max(0, validationScore),
    issues,
    recommendations
  };
}

// 증빙 관련성 검증
function checkEvidenceRelevance(
  requiredEvidence: string,
  submittedFiles: string[],
  resultText: string
): boolean {
  // 필요증빙에서 요구하는 키워드 추출
  const requiredKeywords = extractRequiredKeywords(requiredEvidence);
  
  // 이행현황 텍스트에서 관련 키워드 확인
  const resultTextLower = resultText.toLowerCase();
  const hasRelevantContent = requiredKeywords.some(keyword => 
    resultTextLower.includes(keyword.toLowerCase())
  );

  // 제출된 파일명에서 관련 키워드 확인
  const hasRelevantFiles = submittedFiles.some(file => {
    const fileName = file.toLowerCase();
    return requiredKeywords.some(keyword => 
      fileName.includes(keyword.toLowerCase())
    );
  });

  return hasRelevantContent || hasRelevantFiles;
}

// 증빙 적절성 검증
function checkEvidenceAppropriateness(
  requiredEvidence: string,
  submittedFiles: string[]
): boolean {
  const requiredTypes = extractRequiredEvidenceTypes(requiredEvidence);
  const submittedTypes = submittedFiles.map(file => {
    const ext = path.extname(file).toLowerCase();
    if (['.pdf', '.doc', '.docx', '.hwp'].includes(ext)) return '문서' as const;
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return '이미지' as const;
    if (['.xls', '.xlsx', '.csv'].includes(ext)) return '스프레드시트' as const;
    return '기타' as const;
  });

  // 요구되는 증빙 유형과 제출된 유형 매칭
  return requiredTypes.some(type => submittedTypes.includes(type as any));
}

// 증빙 완성도 검증
function checkEvidenceCompleteness(
  submittedFiles: string[],
  resultText: string
): boolean {
  // 파일이 있고, 이행현황에 구체적인 내용이 있는지 확인
  const hasFiles = submittedFiles && submittedFiles.length > 0;
  const hasDetailedContent = resultText.length > 50 && 
    !isMeaninglessText(resultText);
  
  return hasFiles && hasDetailedContent;
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

// 증빙 안내 메시지 생성 함수
function generateEvidenceGuidance(
  evidenceValidation: {
    isRelevant: boolean;
    isAppropriate: boolean;
    isComplete: boolean;
    validationScore: number;
    issues: string[];
    recommendations: string[];
  },
  requiredEvidence: string
): string {
  let guidance = '';
  
  // 핵심 문제점만 간결하게 표시
  if (!evidenceValidation.isRelevant) {
    guidance += '• 제출된 증빙이 체크리스트 항목과 관련성이 없습니다\n';
  }
  
  if (!evidenceValidation.isAppropriate) {
    const requiredTypes = extractRequiredEvidenceTypes(requiredEvidence);
    guidance += `• 요구되는 증빙 유형: ${requiredTypes.join(', ')}\n`;
  }
  
  if (!evidenceValidation.isComplete) {
    guidance += '• 증빙이 불완전하거나 내용이 부족합니다\n';
  }
  
  // 샘플/테스트 증빙 감지
  if (evidenceValidation.issues.some(issue => issue.includes('샘플') || issue.includes('테스트'))) {
    guidance += '• 샘플 또는 테스트용 증빙이 감지되었습니다\n';
  }
  
  // 빈 증빙 감지
  if (evidenceValidation.issues.some(issue => issue.includes('빈') || issue.includes('내용이 없'))) {
    guidance += '• 빈 증빙 또는 내용이 없는 파일이 감지되었습니다\n';
  }
  
  // 증빙 개수 부족 감지
  const evidenceCount = evidenceValidation.issues.filter(issue => 
    issue.includes('개') && (issue.includes('부족') || issue.includes('누락'))
  );
  if (evidenceCount.length > 0) {
    guidance += `• ${evidenceCount[0]}\n`;
  }
  
  // 누락된 증빙 유형 감지
  const missingTypes = evidenceValidation.issues.filter(issue => 
    issue.includes('누락된 증빙 유형')
  );
  if (missingTypes.length > 0) {
    guidance += `• ${missingTypes[0]}\n`;
  }
  
  if (guidance) {
    guidance = '⚠️ 증빙 검증 실패\n\n' + guidance;
    guidance += '\n적절한 증빙을 제출한 후 다시 평가해주세요.';
  }
  
  return guidance;
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
      return { type: 'text', content: `[PDF 분석: ${fileName} (${fileSize} KB, ${data.numpages} 페이지)]\n${data.text}`, fileName };
    } catch (pdfError) {
      console.error('PDF 분석 오류:', pdfError);
      return { type: 'text', content: `[PDF 분석 실패: ${fileName}]`, fileName };
    }
  }
  
  // 텍스트 기반 파일인 경우
  if (['.txt', '.md', '.json', '.csv'].includes(fileExtension)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { type: 'text', content: `[텍스트 파일 분석: ${fileName} (${fileSize} KB)]\n${content}`, fileName };
  }
  
  // HWP 파일인 경우 (API가 지원하지 않으므로 파일 정보만 제공)
  if (fileExtension === '.hwp') {
    return { 
      type: 'text', 
      content: `[한글 문서 파일: ${fileName} (${fileSize} KB)]\n한글 문서 파일이 업로드되었습니다. API는 현재 HWP 파일 형식을 직접 지원하지 않습니다. 파일 내용을 확인하려면 PDF로 변환 후 업로드해주세요.`, 
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

    // 증빙 내용 적절성 검증
    const evidenceValidation = validateEvidenceContent(
      requiredEvidence,
      resultFiles || [],
      resultText,
      evaluationMethod
    );

    console.log('증빙 분석 결과:', {
      needsEvidence,
      evidenceEvaluation,
      evidenceValidation
    });

    // 증빙이 부적절한 경우 평가 대신 안내 메시지 반환
    if (evidenceValidation.validationScore < 70) {
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

    // 파일 분석 실행
    const fileAnalyses: FileAnalysisResult[] = resultFiles && resultFiles.length > 0
      ? await Promise.all(resultFiles.map(analyzeFile))
      : [];

    const textAnalyses = fileAnalyses
      .filter(f => f.type === 'text')
      .map(f => f.content)
      .join('\n\n');

    const imageAnalyses = fileAnalyses.filter(f => f.type === 'image');

    const promptText = `평가방법을 기준으로 준수 여부를 판단하고 준수율을 산출하세요.

평가방법: ${evaluationMethod}
이행현황: ${resultText}
첨부파일: ${textAnalyses || '없음'}

다음 JSON 형식으로만 응답하세요:
{
  "complianceRate": 0-100,
  "evaluationBasis": [
    {
      "criterion": "평가 기준 문장",
      "satisfied": true/false,
      "type": "필수",
      "reason": "충족/부족 사유"
    }
  ],
  "improvementPlan": [
    {
      "item": "개선 항목",
      "action": "개선 방안"
    }
  ]
}`;

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

    // API 키 확인
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('API 키가 설정되지 않았습니다.');
    }

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
            maxOutputTokens: 4096,
            temperature: 0.1
          }
        };

        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

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
          throw error; // 모든 재시도 실패 시 최종 에러 throw
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
      }
    }

    if (!response) {
      throw new Error('API 요청에 대한 응답을 받지 못했습니다.');
    }
    
    const data = await response.json();
    
    // API 응답 구조 안전하게 처리
    console.log('API Raw Response Data:', JSON.stringify(data, null, 2)); // 디버깅용
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      // MAX_TOKENS 오류인 경우 특별 처리
      if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'MAX_TOKENS') {
        throw new Error('응답이 너무 길어서 토큰 제한에 걸렸습니다. 프롬프트를 단축해주세요.');
      }
      
      throw new Error('API 응답 구조가 예상과 다릅니다. 응답: ' + JSON.stringify(data));
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
          criterion: "평가 중 오류 발생",
          satisfied: false,
          type: "필수",
          reason: "AI 응답 파싱 오류로 인해 평가를 완료할 수 없습니다."
        }],
        improvementPlan: [{
          item: "시스템 오류",
          action: "잠시 후 다시 시도해주세요."
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
        improvement = '• AI가 구체적인 개선 방안을 제시하지 못했습니다. 평가 근거의 "부족" 항목을 확인하여 조치해야 합니다.';
      }
    } else {
      // 필수 항목 부족이 없을 때 (통과 상태)
      if (evaluationResult.complianceRate === 100) {
        improvement = '모든 기준을 충족하여 추가 개선사항 없음';
      } else if (evaluationResult.complianceRate >= 70) {
        // 70% 이상이면 통과 상태
        if (evaluationResult.improvementSuggestions && evaluationResult.improvementSuggestions.length > 0) {
          improvement = evaluationResult.improvementSuggestions.map((item: string) => `• ${item}`).join('\n');
        } else {
          improvement = '모든 필수 기준을 충족하여 통과하였으나, 세부 사항은 평가 근거를 확인하세요.';
        }
      } else {
        // 70% 미만이면 불통과 상태
        if (evaluationResult.improvementSuggestions && evaluationResult.improvementSuggestions.length > 0) {
          improvement = evaluationResult.improvementSuggestions.map((item: string) => `• ${item}`).join('\n');
        } else {
          improvement = '• 준수율이 70% 미만으로 불통과입니다. 평가 근거의 "부족" 항목을 확인하여 조치해야 합니다.';
        }
      }
    }
    
    // 평가 근거(basis)를 프론트엔드에서 사용하기 좋은 문자열 형태로 변환
    const basis = evaluationResult.evaluationBasis.map((item: any) => 
      `${item.satisfied ? '✓ 충족' : '✗ 부족'} (${item.type}) ${item.criterion}\n  - 사유: ${item.reason}`
    ).join('\n');

    res.status(200).json({
      progress: evaluationResult.complianceRate,
      improvement,
      basis,
      evidenceAnalysis: {
        needsEvidence,
        evidenceEvaluation,
        evidenceValidation,
        evidenceImpact: needsEvidence && !evidenceEvaluation.hasEvidence ? 
          '증빙 누락으로 인한 점수 차감 적용' : 
          evidenceEvaluation.complianceScore < 70 ? 
          '증빙 품질 부족으로 인한 점수 조정' : 
          evidenceValidation.validationScore < 70 ?
          '증빙 내용 검증 실패로 인한 점수 차감' :
          '증빙 기준 충족'
      }
    });

  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ 
      error: '평가 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}