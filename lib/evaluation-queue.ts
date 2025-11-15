// lib/evaluation-queue.ts
import EvaluationJob, { IEvaluationJob } from '../models/EvaluationJob';
import ChecklistItem from '../models/ChecklistItem';
import { callGeminiAPI } from './gemini-client';
import crypto from 'crypto';

class AsyncEvaluationQueue {
  private processing: Set<string> = new Set();
  private isProcessing = false;

  /**
   * 평가 작업을 큐에 추가 (즉시 응답)
   */
  async enqueue(
    itemId: string,
    evaluationData: {
      evaluationMethod: string;
      requiredEvidence: string;
      resultText: string;
      resultFiles: string[];
      implementationStatus?: string;
    },
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    const jobId = crypto.randomUUID();

    const job = new EvaluationJob({
      jobId,
      itemId,
      status: 'pending',
      priority,
      ...evaluationData,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    });

    await job.save();

    // 백그라운드 처리 시작 (비동기)
    this.processQueue().catch(console.error);

    return jobId;
  }

  /**
   * 큐에서 작업을 처리 (백그라운드)
   */
  async processQueue() {
    // 이미 처리 중이면 스킵
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 우선순위 순으로 대기 중인 작업 조회
      const pendingJobs = await EvaluationJob.find({
        status: { $in: ['pending', 'failed'] },
        $or: [
          { nextRetryAt: { $exists: false } },
          { nextRetryAt: { $lte: new Date() } },
        ],
      })
        .sort({ priority: -1, createdAt: 1 }) // 우선순위 높은 순, 생성 시간 빠른 순
        .limit(5); // 한 번에 최대 5개 처리

      for (const job of pendingJobs) {
        if (this.processing.has(job.jobId)) continue;

        this.processing.add(job.jobId);
        
        try {
          await this.processJob(job);
        } catch (error) {
          console.error(`작업 ${job.jobId} 처리 중 오류:`, error);
        } finally {
          this.processing.delete(job.jobId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 개별 작업 처리
   */
  private async processJob(job: IEvaluationJob) {
    // 상태를 processing으로 변경
    job.status = 'processing';
    job.startedAt = new Date();
    job.attempts++;
    await job.save();

    try {
      // 실제 평가 수행
      const result = await this.performEvaluation(job);

      // 결과 저장
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      await job.save();

      // ChecklistItem 업데이트
      await this.updateChecklistItem(job.itemId, result);

      console.log(`평가 작업 ${job.jobId} 완료`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      job.attempts++;
      
      if (job.attempts >= job.maxAttempts) {
        // 최대 재시도 횟수 초과
        job.status = 'failed';
        job.error = `최대 재시도 횟수 초과: ${errorMessage}`;
        job.completedAt = new Date();
        await job.save();
        
        // 실패 알림 (선택사항)
        await this.notifyFailure(job);
      } else {
        // 재시도 예약
        job.status = 'failed'; // 다음 처리 대기
        job.error = errorMessage;
        
        // Exponential Backoff
        const delay = Math.min(60000 * Math.pow(2, job.attempts - 1), 600000);
        job.nextRetryAt = new Date(Date.now() + delay);
        await job.save();
      }
    }
  }

  /**
   * 실제 평가 수행
   */
  private async performEvaluation(job: IEvaluationJob) {
    // 평가 프롬프트 구성
    const prompt = `다음 체크리스트 항목에 대한 평가를 수행해주세요.

평가 방법: ${job.evaluationMethod}
필수 증빙: ${job.requiredEvidence}
이행 현황: ${job.resultText}
${job.implementationStatus ? `구현 상태: ${job.implementationStatus}` : ''}

평가 결과를 다음 JSON 형식으로 반환해주세요:
{
  "progress": 0-100 사이의 숫자,
  "improvement": "개선 사항",
  "basis": "평가 근거",
  "evidenceAnalysis": {}
}`;

    const response = await callGeminiAPI(
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      },
      job.priority,
      'evaluation'
    );

    // 응답 파싱
    const text = response.candidates[0]?.content?.parts[0]?.text || '';
    
    // JSON 추출 시도
    let result;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // JSON이 없으면 기본값
        result = {
          progress: 0,
          improvement: text,
          basis: '',
          evidenceAnalysis: {},
        };
      }
    } catch (e) {
      result = {
        progress: 0,
        improvement: text,
        basis: '',
        evidenceAnalysis: {},
      };
    }

    return {
      progress: result.progress || 0,
      improvement: result.improvement || '',
      basis: result.basis || '',
      evidenceAnalysis: result.evidenceAnalysis || {},
    };
  }

  /**
   * ChecklistItem 업데이트
   */
  private async updateChecklistItem(itemId: string, result: any) {
    await ChecklistItem.findByIdAndUpdate(itemId, {
      progress: result.progress,
      improvement: result.improvement,
      status: result.progress >= 80 ? '이행' : 
             result.progress >= 50 ? '부분이행' : '미이행',
    });
  }

  /**
   * 작업 상태 조회
   */
  async getStatus(jobId: string) {
    const job = await EvaluationJob.findOne({ jobId });
    if (!job) return null;

    return {
      jobId: job.jobId,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      nextRetryAt: job.nextRetryAt,
      error: job.error,
      result: job.result,
    };
  }

  /**
   * 특정 항목의 최신 작업 조회
   */
  async getLatestJob(itemId: string) {
    return await EvaluationJob.findOne({ itemId })
      .sort({ createdAt: -1 });
  }

  /**
   * 실패 알림 (선택사항)
   */
  private async notifyFailure(job: IEvaluationJob) {
    console.error(`평가 작업 실패: ${job.jobId}`, job.error);
  }
}

export const evaluationQueue = new AsyncEvaluationQueue();

// 주기적으로 큐 처리 (30초마다)
if (typeof window === 'undefined') {
  setInterval(() => {
    evaluationQueue.processQueue().catch(console.error);
  }, 30000);
}

