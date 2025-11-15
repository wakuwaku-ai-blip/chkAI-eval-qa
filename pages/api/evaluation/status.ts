// pages/api/evaluation/status.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { evaluationQueue } from '../../../lib/evaluation-queue';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId, itemId } = req.query;

  if (jobId && typeof jobId === 'string') {
    const status = await evaluationQueue.getStatus(jobId);
    if (!status) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.',
        message: '이미 처리되었거나 존재하지 않는 작업입니다.',
      });
    }
    return res.status(200).json(status);
  }

  if (itemId && typeof itemId === 'string') {
    const job = await evaluationQueue.getLatestJob(itemId);
    if (!job) {
      return res.status(404).json({
        error: '평가 작업을 찾을 수 없습니다.',
      });
    }
    return res.status(200).json({
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
    });
  }

  return res.status(400).json({
    error: 'jobId 또는 itemId가 필요합니다.',
  });
}

