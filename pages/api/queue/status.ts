// pages/api/queue/status.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { geminiRequestQueue } from '../../../lib/request-queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const status = geminiRequestQueue.getQueueStatus();

  res.status(200).json({
    ...status,
    timestamp: new Date().toISOString(),
  });
}

