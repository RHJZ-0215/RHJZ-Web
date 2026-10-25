// ─────────────────────────────────────────────────────────────
// Blob 路径规范化：网页上传与程序化 API 上传共用
// 规则参考 @vercel/blob：pathname 不能包含 "//"，长度上限 950
// ─────────────────────────────────────────────────────────────

export const MAX_PATHNAME_LENGTH = 900

export interface PathnameResult {
  pathname?: string
  error?: string
}

/** 去掉控制字符与首尾空白 */
function cleanSegment(seg: string): string {
  return seg.replace(/[\u0000-\u001f\u007f]/g, '').trim()
}

/** 从任意路径（含 Windows 反斜杠）中取出文件名 */
export function baseName(input: string): string {
  const parts = input.replace(/\\/g, '/').split('/').filter(Boolean)
  return cleanSegment(parts[parts.length - 1] || '')
}

/**
 * 规范化上传目标路径。
 * - 反斜杠转斜杠，丢弃空段与 "."，拒绝 ".."
 * - folder 为可选目录前缀，raw 为空时退回 fallbackName（通常是本地文件名）
 */
export function normalizePathname(
  raw?: string | null,
  fallbackName?: string | null,
  folder?: string | null,
): PathnameResult {
  const segments: string[] = []

  const push = (value?: string | null) => {
    if (!value) return
    for (const seg of value.replace(/\\/g, '/').split('/')) {
      const cleaned = cleanSegment(seg)
      if (!cleaned || cleaned === '.') continue
      if (cleaned === '..') throw new Error('路径不能包含 ".."')
      segments.push(cleaned)
    }
  }

  try {
    push(folder)
    const explicit = (raw || '').trim()
    push(explicit || fallbackName)
  } catch (error: any) {
    return { error: error?.message || '路径不合法' }
  }

  if (segments.length === 0) return { error: '缺少文件名或目标路径' }

  const pathname = segments.join('/')
  if (pathname.length > MAX_PATHNAME_LENGTH) {
    return { error: `路径过长（上限 ${MAX_PATHNAME_LENGTH} 字符）` }
  }
  return { pathname }
}

/** 从 Content-Type 或扩展名推断 MIME，未识别时退回 octet-stream */const EXT_MIME: Record<string, string> = {
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  yml: 'text/yaml; charset=utf-8',
  yaml: 'text/yaml; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
}

export function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_MIME[ext] || 'application/octet-stream'
}

/** 由 pathname 构造本站下载链接（逐段编码，支持多级目录） */
export function blobDownloadUrl(pathname: string): string {
  const encoded = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `/api/download/${encoded}`
}

/**
 * 把 catch-all 路由参数还原成 blob pathname。
 * Next 已对 query 做过一次解码，这里不再二次解码，避免文件名含 % 时被破坏。
 */
export function pathnameFromSegments(raw: string | string[] | undefined): string {
  const segments = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  return segments
    .flatMap((seg) => String(seg).replace(/\\/g, '/').split('/'))
    .map((seg) => seg.trim())
    .filter(Boolean)
    .join('/')
}
