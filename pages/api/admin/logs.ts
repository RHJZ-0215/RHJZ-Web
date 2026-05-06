import type { NextApiRequest, NextApiResponse } from 'next';
import { getLogs, getLogsByType, LogEntry } from '../../../utils/logger';

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || '';
  return cookies.includes('admin=authenticated');
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ status: 'error', message: '未登录或权限不足' });
  }

  const { type, limit, offset } = req.query;
  
  let filteredLogs: LogEntry[] = getLogs();
  
  // 按类型过滤
  if (type && typeof type === 'string') {
    const validTypes: LogEntry['type'][] = ['access', 'upload', 'download', 'login', 'logout', 'command', 'error', 'system'];
    if (validTypes.includes(type as LogEntry['type'])) {
      filteredLogs = getLogsByType(type as LogEntry['type']);
    }
  }
  
  // 分页处理
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : 50;
  const offsetNum = typeof offset === 'string' ? parseInt(offset, 10) : 0;
  
  const paginatedLogs = filteredLogs.slice(offsetNum, offsetNum + limitNum);
  
  return res.status(200).json({
    status: 'success',
    data: paginatedLogs,
    total: filteredLogs.length,
    limit: limitNum,
    offset: offsetNum,
  });
}