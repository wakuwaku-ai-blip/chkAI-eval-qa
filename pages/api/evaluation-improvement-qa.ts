import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// 메모리 기반 AI Q&A 히스토리 저장
const aiQaHistoryMap = new Map<string, Array<{
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}>>();

// 이상한 문자 및 의미없는 질문 필터링 함수
const isInvalidQuestion = (input: string): boolean => {
  const trimmed = input.trim();
  
  // 1. 빈 문자열 또는 공백만 있는 경우
  if (!trimmed) return true;
  
  // 2. 2글자 이하인 경우
  if (trimmed.length <= 2) return true;
  
  // 3. 숫자만 있는 경우 (1자리 이상)
  if (/^\d+$/.test(trimmed)) return true;
  
  // 4. 특수문자만 있는 경우
  if (/^[^\w가-힣\s]+$/.test(trimmed)) return true;
  
  // 5. 키보드 연타 패턴 (asdf, qwer, zxcv 등)
  const keyboardPatterns = /^(asdf|qwer|zxcv|hjkl|uiop|nm,\.|asd|qwe|zxc|jkl|uio|nm,)$/i;
  if (keyboardPatterns.test(trimmed)) return true;
  
  // 6. 같은 문자 반복 (aaaa, bbbb, 1111 등)
  if (/^(.)\1{2,}$/.test(trimmed)) return true;
  
  // 7. 테스트용 입력
  const testPatterns = /^(test|테스트|test\d+|테스트\d+|testing|테스팅)$/i;
  if (testPatterns.test(trimmed)) return true;
  
  // 8. 의미없는 조합 (abc, def, 123, 456 등)
  if (/^(abc|def|ghi|jkl|mno|pqr|stu|vwx|yz|123|456|789|012|345|678|901)$/i.test(trimmed)) return true;
  
  // 9. 한글 자음/모음만 있는 경우 (ㅇㅇㅇ, ㅏㅏㅏ 등)
  if (/^[ㄱ-ㅎㅏ-ㅣ]{2,}$/.test(trimmed)) return true;
  
  // 10. 이상한 문자 조합 (23ㅓㅗㄷㄴ론 나얼미ㅏㄴ어ㅇㄴ 등)
  if (/[ㄱ-ㅎㅏ-ㅣ]{2,}.*[ㄱ-ㅎㅏ-ㅣ]{2,}/.test(trimmed)) return true;
  
  // 11. 한글과 숫자가 이상하게 섞인 경우 (23ㅓㅗㄷㄴ론 등)
  if (/\d+[ㄱ-ㅎㅏ-ㅣ]+/.test(trimmed)) return true;
  
  // 12. 의미없는 한글 조합 (나얼미ㅏㄴ어ㅇㄴ 등)
  if (/^[가-힣]*[ㄱ-ㅎㅏ-ㅣ]{2,}[가-힣]*$/.test(trimmed)) return true;
  
  // 13. 연속된 자음/모음 (ㅓㅗㄷㄴ, ㅏㄴ어ㅇㄴ 등)
  if (/[ㄱ-ㅎㅏ-ㅣ]{3,}/.test(trimmed)) return true;
  
  return false;
};

// 의미없는 질문 필터링 함수 (기존 호환성 유지)
const isMeaninglessQuestion = isInvalidQuestion;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { question, evaluationData } = req.body;
      
      if (!question || !evaluationData) {
        return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
      }

      // 의미없는 질문 필터링
      if (isMeaninglessQuestion(question)) {
        return res.status(400).json({ error: '올바른 질문을 입력해 주세요. 한글, 영문, 숫자가 포함된 의미있는 문장으로 작성해 주세요.' });
      }

      // API 키 확인
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
      }

      // 세션 ID 생성
      const sessionId = `ai_qa_${Date.now()}`;

      // 기존 대화 히스토리 가져오기
      let history = aiQaHistoryMap.get(sessionId);
      if (!history) {
        history = [];
        aiQaHistoryMap.set(sessionId, history);
      }

      // 컨텍스트 정보 구성 (평가근거와 개선방안 모두 포함)
      const context = `
=== 평가 정보 ===
준수율: ${evaluationData.progress}%
${evaluationData.basis ? `평가근거: ${evaluationData.basis}` : ''}
${evaluationData.improvement ? `개선방안: ${evaluationData.improvement}` : ''}

=== 원본 항목 정보 ===
평가항목: ${evaluationData.originalItem.item}
항목번호: ${evaluationData.originalItem.itemNumber}
평가방법: ${evaluationData.originalItem.evaluationMethod}
필요증빙: ${evaluationData.originalItem.requiredEvidence}
관련법령: ${evaluationData.originalItem.relatedLaw}
세부조항: ${evaluationData.originalItem.details}
========================
      `.trim();

      // 시스템 프롬프트 구성
      const systemPrompt = `정보보호 관련 법규 전문가이자 보안현황 분석 및 개선전문가입니다. 참고 정보만 사용하여 간결하게 한글로 답변하세요. 외부 지식 금지.`;

      // 대화 히스토리 구성
      const conversationHistory = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // API 호출
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\n참고 정보:\n${context}\n\n질문: ${question}`
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // API 응답 구조 안전하게 처리
      console.log('API Raw Response Data:', JSON.stringify(response.data, null, 2)); // 디버깅용
      
      if (!response.data.candidates || !response.data.candidates[0] || !response.data.candidates[0].content) {
        throw new Error('API 응답 구조가 예상과 다릅니다. 응답: ' + JSON.stringify(response.data));
      }
      
      // finishReason 확인
      if (response.data.candidates[0].finishReason === 'MAX_TOKENS') {
        console.warn('API 응답이 토큰 제한으로 잘렸습니다.');
      }
      
      // content.parts가 있는 경우와 없는 경우 모두 처리
      let aiResponse: string;
      if (response.data.candidates[0].content.parts && response.data.candidates[0].content.parts[0]) {
        aiResponse = response.data.candidates[0].content.parts[0].text;
      } else {
        // parts가 없는 경우 (예: MAX_TOKENS로 잘린 경우)
        aiResponse = '응답이 토큰 제한으로 잘렸습니다. 더 간단한 질문을 해주세요.';
      }

      // 답변 후처리: 마크다운, 따옴표, 참조 번호 제거 (표 문법은 유지)
      const cleanAnswer = aiResponse
        .replace(/\*\*(.*?)\*\*/g, '$1') // **텍스트** → 텍스트
        .replace(/\*(.*?)\*/g, '$1') // *텍스트* → 텍스트
        .replace(/#{1,6}\s+/g, '') // # 제목 → 제목
        .replace(/-\s+/g, '• ') // - 목록 → • 목록
        .replace(/`(.*?)`/g, '$1') // `코드` → 코드
        .replace(/\[(\d+)\]/g, '') // [1], [2] 등 제거
        .replace(/\[(.*?)\]/g, '$1') // [텍스트] → 텍스트
        .replace(/"/g, '') // 따옴표 제거
        .replace(/''/g, '') // 작은따옴표 제거
        .replace(/\n{3,}/g, '\n\n') // 3개 이상 연속된 줄바꿈을 2개로
        .replace(/[一-龯]/g, '') // 한자 제거
        .replace(/[a-zA-Z]/g, '') // 영어 제거
        .trim();

      // 히스토리에 사용자 질문과 AI 답변 추가
      history.push({
        role: 'user',
        content: question,
        timestamp: new Date()
      });
      history.push({
        role: 'assistant',
        content: cleanAnswer,
        timestamp: new Date()
      });

      // 최근 10개 메시지만 유지
      if (history.length > 10) {
        history = history.slice(-10);
        aiQaHistoryMap.set(sessionId, history);
      }

      res.status(200).json({
        answer: cleanAnswer,
        history: history
      });

    } catch (error) {
      console.error('AI Q&A API 오류:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios 오류 상세:', {
          status: error.response?.status,
          data: error.response?.data,
          config: error.config?.data
        });
      }
      res.status(500).json({ error: 'AI Q&A 처리 중 오류가 발생했습니다.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

/* 
// Perplexity API 호출 (주석 처리 - 필요시 사용)
const response = await axios.post(
  'https://api.perplexity.ai/chat/completions',
  {
    model: 'sonar',
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: `참고 정보:\n${context}\n\n질문: ${question}` }
    ],
    max_tokens: 1000,
    temperature: 0.7
  },
  {
    headers: {
      'Authorization': `Bearer ${perplexityApiKey}`,
      'Content-Type': 'application/json'
    }
  }
);

const aiResponse = response.data.choices[0].message.content;
*/ 