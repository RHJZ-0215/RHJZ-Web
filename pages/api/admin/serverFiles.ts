import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || '';
  return cookies.includes('admin=authenticated');
}

interface ServerFile {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  path: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ status: 'error', message: '未登录或权限不足' });
  }

  const { dir } = req.query;
  const basePath = process.cwd();
  const targetPath = dir ? path.join(basePath, String(dir)) : basePath;

  try {
    const files = await fs.readdir(targetPath);
    const fileInfoList: ServerFile[] = [];

    for (const file of files) {
      const filePath = path.join(targetPath, file);
      const stats = await fs.stat(filePath);
      
      fileInfoList.push({
        name: file,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.isFile() ? stats.size : undefined,
        mtime: stats.mtime.toLocaleString('zh-CN'),
        path: path.relative(basePath, filePath),
      });
    }

    // 按类型排序，目录在前
    fileInfoList.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({ 
      status: 'success', 
      files: fileInfoList,
      currentPath: targetPath,
      relativePath: path.relative(basePath, targetPath) || '.'
    });
  } catch (error: any) {
    console.error('List server files error:', error);
    return res.status(500).json({ status: 'error', message: '获取文件列表失败: ' + (error.message || '未知错误') });
  }
}