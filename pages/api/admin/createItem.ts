import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || '';
  return cookies.includes('admin=authenticated');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ status: 'error', message: '未登录或权限不足' });
  }

  const { type, name, parentDir } = req.body;

  if (!type || !name) {
    return res.status(400).json({ status: 'error', message: '类型和名称不能为空' });
  }

  const basePath = process.cwd();
  const targetPath = parentDir ? path.join(basePath, parentDir, name) : path.join(basePath, name);

  try {
    if (type === 'file') {
      await fs.writeFile(targetPath, '', 'utf-8');
      return res.status(200).json({ status: 'success', message: '文件创建成功' });
    } else if (type === 'directory') {
      await fs.mkdir(targetPath, { recursive: true });
      return res.status(200).json({ status: 'success', message: '目录创建成功' });
    } else {
      return res.status(400).json({ status: 'error', message: '无效的类型' });
    }
  } catch (error: any) {
    console.error('Create item error:', error);
    return res.status(500).json({ status: 'error', message: '操作失败: ' + (error.message || '未知错误') });
  }
}