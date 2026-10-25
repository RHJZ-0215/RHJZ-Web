// ─────────────────────────────────────────────────────────────
// 本地文件读取：支持通过"文件路径"直接上传服务器上的指定文件
// 兼容 Windows 盘符路径、正斜杠/反斜杠混用、~ 家目录
//
// 注意：这里刻意不 import Node 的 os 模块 —— Next.js 的 webpack
// 在处理 os 时会去扫描用户家目录，在部分 Windows 环境下触发
// "EPERM: scandir C:\Users\<user>\Application Data" 导致构建失败。
// ─────────────────────────────────────────────────────────────

import fs from 'fs/promises'
import path from 'path'

export interface LocalFileResult {
  buffer?: Buffer
  filename?: string
  size?: number
  error?: string
  status?: number
}

/** 取当前用户家目录（不依赖 os 模块） */
function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || ''
}

/** 展开 ~ 与相对路径，返回绝对路径 */
export function resolveLocalPath(input: string): string {
  let raw = input.trim().replace(/^["']|["']$/g, '')
  const home = homeDir()
  if (home && raw === '~') raw = home
  else if (home && (raw.startsWith('~/') || raw.startsWith('~\\'))) {
    raw = path.join(home, raw.slice(2))
  }
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(process.cwd(), raw)
}

/** 读取本地文件；目录、不存在、过大都返回带 status 的错误 */
export async function readLocalFile(
  input: string,
  maxBytes: number,
): Promise<LocalFileResult> {
  if (!input || !input.trim()) return { error: '缺少本地文件路径', status: 400 }

  const absolute = resolveLocalPath(input)

  let stat
  try {
    stat = await fs.stat(absolute)
  } catch (error: any) {
    const code = error?.code
    if (code === 'ENOENT') {
      return { error: `本地文件不存在: ${absolute}`, status: 404 }
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return { error: `没有权限读取: ${absolute}`, status: 403 }
    }
    return { error: `无法读取本地文件: ${absolute}`, status: 400 }
  }

  if (stat.isDirectory()) {
    return { error: `这是一个目录，不能直接上传: ${absolute}`, status: 400 }
  }
  if (!stat.isFile()) {
    return { error: `不是普通文件: ${absolute}`, status: 400 }
  }
  if (stat.size > maxBytes) {
    return {
      error: `文件过大（${stat.size} 字节），单文件上限 ${maxBytes} 字节`,
      status: 413,
    }
  }

  try {
    const buffer = await fs.readFile(absolute)
    return {
      buffer,
      filename: path.basename(absolute),
      size: buffer.length,
    }
  } catch (error: any) {
    return { error: `读取失败: ${error?.message || '未知错误'}`, status: 400 }
  }
}
