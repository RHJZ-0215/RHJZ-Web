// ─────────────────────────────────────────────────────────────
// API 服务层：统一封装所有后端调用，避免散落的 fetch 与样板代码
// 用法：import { getFiles, login, ... } from '@/lib/api'
// ─────────────────────────────────────────────────────────────

import type {
  FileItem,
  LogRecord,
  LogType,
  RemoteClient,
  ServerFile,
} from '../types'

/** 构造下载链接（直接 <a href>），按路径分段编码以支持 a/b/c.txt */
export function downloadUrl(filename: string): string {
  const encoded = filename
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `/api/download/${encoded}`
}

/** 统一 JSON 请求：网络/解析错误抛异常，业务错误由调用方按 status 判断 */
async function request<T = any>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options)
  let body: any = null
  try {
    body = await res.json()
  } catch {
    throw new Error(`服务器返回无效响应 (${res.status})`)
  }
  return body as T
}

const jsonPost = (url: string, payload: unknown) =>
  request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

// ── 公开：文件列表 / 访问追踪 ─────────────────────────────────

export async function getFiles(): Promise<FileItem[]> {
  try {
    const data = await request<{ files?: FileItem[] }>('/api/files')
    return Array.isArray(data?.files) ? data.files : []
  } catch (e) {
    console.error('getFiles:', e)
    return []
  }
}

export function trackVisit(): void {
  fetch('/api/track', { method: 'POST' }).catch(() => {})
}

// ── 管理员：状态 / 登录登出 ───────────────────────────────────

export async function getAdminStatus(): Promise<boolean> {
  try {
    const data = await request<{ isAdmin: boolean }>('/api/admin/status')
    return !!data?.isAdmin
  } catch (e) {
    console.error('getAdminStatus:', e)
    return false
  }
}

export const adminLogin = (username: string, password: string) =>
  jsonPost('/api/admin/login', { username, password })

export const adminLogout = () =>
  jsonPost('/api/admin/logout', {})

// ── 管理员：日志 ─────────────────────────────────────────────

export async function getLogs(type: string = 'all'): Promise<LogRecord[]> {
  const url =
    type === 'all'
      ? '/api/admin/logs'
      : `/api/admin/logs?type=${encodeURIComponent(type)}`
  try {
    const data = await request<{ data?: LogRecord[] }>(url)
    return data?.data || []
  } catch (e) {
    console.error('getLogs:', e)
    return []
  }
}

// ── 管理员：文件删除 / 上传 ───────────────────────────────────

export const deleteFile = (filename: string) =>
  jsonPost('/api/admin/delete', { filename })

export async function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request('/api/upload', { method: 'POST', body: form })
}

// ── 管理员：服务器本地文件 / 编辑器 / 新建 ───────────────────

export async function getServerFiles(dir?: string): Promise<{
  files: ServerFile[]
  path: string
}> {
  const url = dir
    ? `/api/admin/serverFiles?dir=${encodeURIComponent(dir)}`
    : '/api/admin/serverFiles'
  const data = await request<{ files: ServerFile[]; relativePath: string }>(url)
  return { files: data?.files || [], path: data?.relativePath || '.' }
}

export async function readFileContent(filePath: string): Promise<string> {
  const data = await request<{ content?: string }>(
    `/api/admin/fileContent?filePath=${encodeURIComponent(filePath)}`,
  )
  return data?.content || ''
}

export const writeFileContent = (filePath: string, content: string) =>
  jsonPost(`/api/admin/fileContent?filePath=${encodeURIComponent(filePath)}`, {
    content,
  })

export const createItem = (
  type: 'file' | 'directory',
  name: string,
  parentDir: string,
) => jsonPost('/api/admin/createItem', { type, name, parentDir })

// ── 管理员：Blob 存储 / 命令执行 ──────────────────────────────

export async function getBlobStorage(): Promise<FileItem[]> {
  const data = await request<{ files?: FileItem[] }>('/api/admin/blobStorage')
  return data?.files || []
}

export const executeCommand = (command: string) =>
  jsonPost('/api/admin/cmd', { command })

// ── 远程服务端：客户端列表 ───────────────────────────────────

export async function listClients(): Promise<RemoteClient[]> {
  try {
    const data = await request<{ clients?: RemoteClient[] }>(
      '/api/admin/clients?action=list',
    )
    return data?.clients || []
  } catch (e) {
    console.error('listClients:', e)
    return []
  }
}

export async function getClientScreenshotUrl(
  clientId: string,
): Promise<string | null> {
  const data = await request<{ url?: string }>(
    `/api/admin/clients?action=screenshot&id=${clientId}`,
  )
  return data?.url || null
}

export const removeClient = (clientId: string) =>
  request(`/api/admin/clients?action=remove&id=${clientId}`)

// ── 远程服务端：命令通道 ─────────────────────────────────────

export const sendRemoteCommand = (
  clientId: string,
  command: string,
  type: string,
) =>
  jsonPost(
    `/api/admin/remote?action=sendCommand&clientId=${clientId}`,
    { command, type },
  )

export interface RemoteResult {
  commandId: string
  output: string
  message?: string
}

export async function getRemoteResult(
  clientId: string,
  commandId?: string,
): Promise<RemoteResult | null> {
  const q = commandId
    ? `action=getResult&clientId=${clientId}&commandId=${commandId}`
    : `action=getResult&clientId=${clientId}`
  const data = await request<{ result?: RemoteResult }>(
    `/api/admin/remote?${q}`,
  )
  return data?.result || null
}

export type { LogType }
