// ─────────────────────────────────────────────────────────────
// 上传接口鉴权：给"程序调用"用的 API Key，同时兼容管理员 Cookie
// 配置：环境变量 UPLOAD_API_KEY，可用英文逗号配置多个
// 未配置时接口保持开放（与网页上传同级），并在响应里标注 auth: 'open'
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto'
import type { NextApiRequest } from 'next'

export type UploadAuthVia = 'api-key' | 'admin-cookie' | 'open'

export interface UploadAuthResult {
  ok: boolean
  via: UploadAuthVia
  message?: string
}

/** 读取配置的可用 Key 列表（去空、去重） */
function configuredKeys(): string[] {
  const raw = [process.env.UPLOAD_API_KEY, process.env.BLOB_UPLOAD_API_KEY]
    .filter(Boolean)
    .join(',')
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function isAdminCookie(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || ''
  return cookies.includes('admin=authenticated')
}

/** 从请求里取出调用方提供的 Key：Authorization / X-Api-Key / ?key= */
function providedKey(req: NextApiRequest): string {
  const auth = String(req.headers.authorization || '')
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()

  const apiKey = req.headers['x-api-key']
  if (typeof apiKey === 'string' && apiKey.trim()) return apiKey.trim()
  if (Array.isArray(apiKey) && apiKey[0]) return String(apiKey[0]).trim()

  const queryKey = req.query.key
  if (typeof queryKey === 'string' && queryKey.trim()) return queryKey.trim()

  return ''
}

/** 定长哈希后比较，避免时间侧信道 */
function safeEqual(a: string, b: string): boolean {
  const left = crypto.createHash('sha256').update(a).digest()
  const right = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(left, right)
}

/** 上传接口鉴权：Key 命中 → 通过；管理员 Cookie → 通过；两者都没配 → 开放 */
export function requireUploadAuth(req: NextApiRequest): UploadAuthResult {
  const keys = configuredKeys()
  const given = providedKey(req)

  if (keys.length > 0) {
    if (given && keys.some((key) => safeEqual(given, key))) {
      return { ok: true, via: 'api-key' }
    }
    if (isAdminCookie(req)) return { ok: true, via: 'admin-cookie' }
    return {
      ok: false,
      via: 'api-key',
      message: given
        ? 'API Key 无效'
        : '缺少 API Key（请求头 Authorization: Bearer <key> 或 X-Api-Key）',
    }
  }

  // 未配置 Key：接口开放，任何程序都能上传（与网页上传一致）
  if (isAdminCookie(req)) return { ok: true, via: 'admin-cookie' }
  return { ok: true, via: 'open' }
}

/** 是否已配置 API Key（用于前端提示与 GET 自描述） */
export function hasConfiguredKey(): boolean {
  return configuredKeys().length > 0
}
