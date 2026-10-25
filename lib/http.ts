// ─────────────────────────────────────────────────────────────
// 服务端 HTTP 小工具：客户端 IP、CORS、统一错误响应
// 仅用于 API 路由（pages/api/**）
// ─────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next'

/** 取真实客户端 IP（Vercel 走 x-forwarded-for） */
export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress || 'unknown'
}

/** 允许跨域调用，方便任意程序（脚本 / 桌面端 / 其他服务）直接请求 */
export function setCors(res: NextApiResponse, methods = 'GET, POST, PUT, DELETE, OPTIONS'): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Filename, X-Local-Path, X-Overwrite, X-Folder',
  )
  res.setHeader('Access-Control-Max-Age', '86400')
}

/** 统一错误响应 */
export function fail(
  res: NextApiResponse,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
) {
  return res.status(status).json({ status: 'error', message, ...(extra || {}) })
}

/** 405 + Allow 头 */
export function methodNotAllowed(res: NextApiResponse, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '))
  return fail(res, 405, `只支持 ${allowed.join(' / ')} 请求`)
}

/** 读取请求体（带大小上限），超限抛 httpCode=413 的错误 */
export async function readRequestBody(
  req: NextApiRequest,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any)
    total += buf.length
    if (total > maxBytes) {
      const error: any = new Error(`请求体超过上限 ${maxBytes} 字节`)
      error.httpCode = 413
      throw error
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

/** 取 query 或 header 的字符串值 */
export function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim()
    }
  }
  return ''
}

/** 布尔参数：1/true/yes/on 视为真 */
export function parseFlag(...values: unknown[]): boolean {
  const raw = firstString(...values).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** 由请求推导站点根地址（用于自描述里的示例） */
export function originOf(req: NextApiRequest): string {
  const proto = String(req.headers['x-forwarded-proto'] || 'https')
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
  return `${proto}://${host}`
}
