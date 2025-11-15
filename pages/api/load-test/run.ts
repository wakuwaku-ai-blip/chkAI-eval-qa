// pages/api/load-test/run.ts
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import crypto from 'crypto';

interface LoadTestConfig {
  concurrentUsers: number;
  requestsPerUser: number;
  endpoint: string;
  requestData: any;
  duration?: number; // 초 단위
}

interface TestResult {
  userId: number;
  requestId: number;
  success: boolean;
  status?: number;
  duration: number;
  error?: string;
}

// 테스트 결과 저장 (실제로는 DB에 저장하는 것이 좋음)
const testResults: Map<string, {
  testId: string;
  config: LoadTestConfig;
  startTime: Date;
  endTime?: Date;
  results: TestResult[];
  summary?: any;
}> = new Map();

class LoadTester {
  async run(config: LoadTestConfig): Promise<{ testId: string; summary: any }> {
    const testId = crypto.randomUUID();
    const startTime = new Date();
    const results: TestResult[] = [];

    // 테스트 시작 기록
    testResults.set(testId, {
      testId,
      config,
      startTime,
      results: [],
    });

    console.log(`부하 테스트 시작: ${config.concurrentUsers}명 동시 사용자`);

    // 비동기로 테스트 실행
    this.executeTest(testId, config).catch(console.error);

    // 즉시 응답 (테스트는 백그라운드에서 실행)
    return {
      testId,
      summary: {
        status: 'running',
        message: '부하 테스트가 시작되었습니다.',
      },
    };
  }

  private async executeTest(testId: string, config: LoadTestConfig) {
    const results: TestResult[] = [];
    const startTime = Date.now();
    const endTime = config.duration 
      ? startTime + (config.duration * 1000)
      : null;

    // 동시 사용자 시뮬레이션
    const promises = Array.from({ length: config.concurrentUsers }, (_, i) =>
      this.simulateUser(i, config, endTime)
    );

    const userResults = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    // 결과 집계
    const allResults = userResults.flat();
    const successful = allResults.filter((r) => r.success);
    const failed = allResults.filter((r) => !r.success);

    const summary = {
      totalRequests: allResults.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      successRate: allResults.length > 0 
        ? (successful.length / allResults.length) * 100 
        : 0,
      totalTime,
      avgResponseTime: successful.length > 0
        ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
        : 0,
      minResponseTime: successful.length > 0
        ? Math.min(...successful.map((r) => r.duration))
        : 0,
      maxResponseTime: successful.length > 0
        ? Math.max(...successful.map((r) => r.duration))
        : 0,
      requestsPerSecond: allResults.length / (totalTime / 1000),
    };

    // 결과 저장
    const testData = testResults.get(testId);
    if (testData) {
      testData.endTime = new Date();
      testData.results = allResults;
      testData.summary = summary;
    }

    console.log('부하 테스트 결과:', summary);
  }

  private async simulateUser(
    userId: number,
    config: LoadTestConfig,
    endTime: number | null
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    for (let i = 0; i < config.requestsPerUser; i++) {
      // 종료 시간 체크
      if (endTime && Date.now() >= endTime) {
        break;
      }

      const startTime = Date.now();
      try {
        const response = await axios.post(
          `${baseUrl}${config.endpoint}`,
          config.requestData,
          {
            timeout: 60000, // 1분 타임아웃
          }
        );
        const duration = Date.now() - startTime;

        results.push({
          userId,
          requestId: i,
          success: true,
          status: response.status,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        results.push({
          userId,
          requestId: i,
          success: false,
          status: error.response?.status,
          duration,
          error: error.message,
        });
      }

      // 요청 간 약간의 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  getResult(testId: string) {
    return testResults.get(testId);
  }

  getAllResults() {
    return Array.from(testResults.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }
}

const loadTester = new LoadTester();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config: LoadTestConfig = req.body;

    // 유효성 검사
    if (!config.concurrentUsers || !config.requestsPerUser || !config.endpoint) {
      return res.status(400).json({
        error: 'concurrentUsers, requestsPerUser, endpoint는 필수입니다.',
      });
    }

    if (config.concurrentUsers > 100) {
      return res.status(400).json({
        error: '동시 사용자 수는 100명을 초과할 수 없습니다.',
      });
    }

    const result = await loadTester.run(config);
    res.status(200).json(result);
  } catch (error) {
    console.error('부하 테스트 실행 오류:', error);
    res.status(500).json({
      error: '부하 테스트 실행 중 오류가 발생했습니다.',
    });
  }
}

// 결과 조회를 위한 export
export { loadTester };

