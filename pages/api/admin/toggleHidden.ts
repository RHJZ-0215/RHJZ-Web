import type { NextApiRequest, NextApiResponse } from 'next';
import { setMetadata } from '../../../utils/fileMetadata';
import { addLog } from '../../../utils/logger';

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || '';
  return cookies.includes('admin=authenticated');
}

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ status: 'error', message: '未登录或权限不足' });
  }

  const { filename, hidden } = req.body;

  if (!filename) {
    return res.status(400).json({ status: 'error', message: '文件名不能为空' });
  }

  try {
    await setMetadata(filename, { hidden: hidden === true });
    const action = hidden ? '隐藏' : '显示';
    
    await addLog({
      ip: getClientIp(req),
      type: 'system',
      action: '文件管理',
      details: `${action}文件: ${filename}`
    });

    return res.status(200).json({ 
      status: 'success', 
      message: `文件已${action}`,
      hidden: hidden === true
    });
  } catch (error: any) {
    console.error('Toggle hidden error:', error);
    return res.status(500).json({ status: 'error', message: '操作失败: ' + (error.message || '未知错误') });
  }
}