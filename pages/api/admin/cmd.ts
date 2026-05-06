import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import util from 'util';
import { addLog } from '../../../utils/logger';

const execPromise = util.promisify(exec);

// 存储工作目录状态（使用简单的内存存储，生产环境建议使用更持久的存储）
const workingDirs = new Map<string, string>();

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || '';
  return cookies.includes('admin=authenticated');
}

function getClientId(req: NextApiRequest): string {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/clientId=([^;]+)/);
  return match ? match[1] : 'default';
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

  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ status: 'error', message: '命令不能为空' });
  }

  const clientId = getClientId(req);
  let cwd = workingDirs.get(clientId) || process.cwd();

  try {
    // 检查是否是cd命令
    const cdMatch = command.trim().match(/^cd\s+(.+)$/i);
    if (cdMatch) {
      const targetDir = cdMatch[1].trim();
      let newDir = targetDir;
      
      // 处理相对路径
      if (!targetDir.startsWith('/') && !targetDir.match(/^[A-Za-z]:/)) {
        newDir = require('path').join(cwd, targetDir);
      }
      
      // 验证目录是否存在
      const fs = await import('fs/promises');
      const stat = await fs.stat(newDir);
      if (stat.isDirectory()) {
        workingDirs.set(clientId, newDir);
        return res.status(200).json({ 
          status: 'success', 
          message: `当前目录已更改为: ${newDir}`,
          stdout: '',
          stderr: '',
          cwd: newDir
        });
      } else {
        return res.status(400).json({ 
          status: 'error', 
          message: `不是有效的目录: ${targetDir}`,
          cwd: cwd
        });
      }
    }

    // 执行其他命令
    const { stdout, stderr } = await execPromise(command, { 
      cwd: cwd,
      timeout: 30000 
    });

    await addLog({
      ip: getClientIp(req),
      type: 'command',
      action: '命令执行',
      details: `命令: ${command}, 目录: ${cwd}, 成功`
    });

    return res.status(200).json({ 
      status: 'success', 
      message: '命令执行成功',
      stdout: stdout || '',
      stderr: stderr || '',
      cwd: cwd
    });
  } catch (error: any) {
    console.error('Command error:', error);
    
    await addLog({
      ip: getClientIp(req),
      type: 'command',
      action: '命令执行',
      details: `命令: ${command}, 目录: ${cwd}, 失败: ${error.message || '未知错误'}`
    });

    return res.status(500).json({ 
      status: 'error', 
      message: '命令执行失败',
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      cwd: cwd
    });
  }
}