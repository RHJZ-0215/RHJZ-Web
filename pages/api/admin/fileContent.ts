import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || '';
  return cookies.includes('admin=authenticated');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { filePath } = req.query;
  
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ status: 'error', message: '文件路径不能为空' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ status: 'error', message: '未登录或权限不足' });
  }

  const fullPath = path.join(process.cwd(), filePath);

  try {
    if (req.method === 'GET') {
      const content = await fs.readFile(fullPath, 'utf-8');
      return res.status(200).json({ status: 'success', content });
    } else if (req.method === 'POST') {
      const { content } = req.body;
      if (content === undefined) {
        return res.status(400).json({ status: 'error', message: '文件内容不能为空' });
      }
      await fs.writeFile(fullPath, content, 'utf-8');
      return res.status(200).json({ status: 'success', message: '文件保存成功' });
    } else {
      return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('File content error:', error);
    return res.status(500).json({ status: 'error', message: '操作失败: ' + (error.message || '未知错误') });
  }
}