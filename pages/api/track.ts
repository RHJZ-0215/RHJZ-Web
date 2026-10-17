import type { NextApiRequest, NextApiResponse } from 'next';
import { addLog, initLogger } from '../../utils/logger';

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    await initLogger();
    const ip = getClientIp(req);
    const ua = String(req.headers['user-agent'] || '').slice(0, 160);
    const referer = String(req.headers['referer'] || '').slice(0, 200);
    const details = `UA: ${ua}${referer ? ` | 来源: ${referer}` : ''}`;

    await addLog({
      ip,
      type: 'access',
      action: '访问网站',
      details,
    });

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Track access error:', error);
    return res.status(500).json({ status: 'error', message: '记录访问日志失败' });
  }
}
