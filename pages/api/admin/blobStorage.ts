import { list } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || '';
  return cookies.includes('admin=authenticated');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ status: 'error', message: '未登录或权限不足' });
  }

  try {
    const { blobs } = await list();
    
    const files = blobs.map(blob => ({
      name: blob.pathname,
      size: blob.size,
      size_str: formatSize(blob.size),
      mtime: new Date(blob.uploadedAt).toLocaleString('zh-CN'),
      url: blob.url || '',
      type: blob.pathname.includes('.') ? 'file' : 'directory',
    }));

    return res.status(200).json({ status: 'success', files });
  } catch (error) {
    console.error('List blob storage error:', error);
    return res.status(500).json({ status: 'error', message: '获取Blob存储失败' });
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}