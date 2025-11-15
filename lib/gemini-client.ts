// lib/gemini-client.ts
import { geminiRequestQueue } from './request-queue';
import { metricsCollector } from './metrics';
import crypto from 'crypto';

interface GeminiRequest {
  contents: Array<{
    role: string;
    parts: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  }>;
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

/**
 * Gemini API 호출 래퍼 (메트릭 수집 포함)
 */
export async function callGeminiAPI(
  request: GeminiRequest,
  priority: 'high' | 'medium' | 'low' = 'medium',
  endpoint: string = 'gemini-api'
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const result = await geminiRequestQueue.enqueue(
      requestId,
      async () => {
        // API 호출
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(60000), // 1분 타임아웃
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        // ⚠️ 중요: Gemini API 응답의 실제 usageMetadata에서 토큰 사용량 추출
        const usageMetadata = data.usageMetadata;
        if (!usageMetadata) {
          console.warn('usageMetadata가 응답에 없습니다:', data);
        }

        // 실제 API 응답에서 받은 토큰 사용량
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = usageMetadata?.totalTokenCount || 0;
        const cachedTokens = usageMetadata?.cachedContentTokenCount || 0;

        // 비용 계산 (Gemini 2.5 Flash 기준)
        // 입력: $0.30 / 100만 토큰, 출력: $2.50 / 100만 토큰
        const inputCost = (inputTokens / 1000000) * 0.30;
        const outputCost = (outputTokens / 1000000) * 2.50;
        const totalCost = inputCost + outputCost;

        // 실제 사용량 메트릭 기록
        metricsCollector.record({
          timestamp: new Date(),
          endpoint,
          requestId,
          inputTokens,      // 실제 API 응답 값
          outputTokens,     // 실제 API 응답 값
          totalTokens,      // 실제 API 응답 값
          cachedTokens,     // 캐시된 토큰 (선택적)
          cost: totalCost,  // 실제 사용량 기반 계산
          duration: Date.now() - startTime,
          status: 'success',
        });

        // 로깅 (디버깅용)
        if (process.env.NODE_ENV === 'development') {
          console.log('Gemini API 사용량:', {
            inputTokens,
            outputTokens,
            totalTokens,
            cachedTokens,
            cost: totalCost.toFixed(6),
            duration: Date.now() - startTime,
          });
        }

        return data;
      },
      priority
    );

    return result;
  } catch (error) {
    // 에러 메트릭 기록 (실제 사용량 없음)
    metricsCollector.record({
      timestamp: new Date(),
      endpoint,
      requestId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      cost: 0,
      duration: Date.now() - startTime,
      status: 'error',
      errorCode: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

