// pages/api/load-test/results.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { loadTester } from './run';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { testId } = req.query;

  if (testId && typeof testId === 'string') {
    // 특정 테스트 결과 조회
    const result = loadTester.getResult(testId);
    if (!result) {
      return res.status(404).json({
        error: '테스트 결과를 찾을 수 없습니다.',
      });
    }
    return res.status(200).json(result);
  } else {
    // 모든 테스트 결과 조회
    const results = loadTester.getAllResults();
    return res.status(200).json({
      tests: results,
      total: results.length,
    });
  }
}

