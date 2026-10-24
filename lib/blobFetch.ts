// ─────────────────────────────────────────────────────────────
// 读取 Blob 内容：默认走 @vercel/blob 的 get()，
// 若设置了 VERCEL_BLOB_API_URL（仅本地调试用，指向 mock 服务），
// 则直接从该地址取，便于在无真实 Blob 存储时验证下载链路。
// ─────────────────────────────────────────────────────────────

import { get } from '@vercel/blob'

export interface BlobPayload {
  pathname: string
  contentType: string
  size: number
  cacheControl: string
  etag: string
  /** 内容流（Web ReadableStream） */
  stream: ReadableStream<Uint8Array>
}

/** 本地 mock 服务直读（仅当显式配置了 VERCEL_BLOB_API_URL 时生效） */
async function readFromMock(pathname: string): Promise<BlobPayload | null> {
  const base = process.env.VERCEL_BLOB_API_URL
  if (!base) return null

  const encoded = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')

  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/blob/${encoded}`)
    if (!response.ok || !response.body) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const bytes = new Uint8Array(buffer)
    return {
      pathname,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      size: bytes.byteLength,
      cacheControl: 'private, max-age=0',
      etag: `W/"${bytes.byteLength}"`,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes)
          controller.close()
        },
      }),
    }
  } catch {
    return null
  }
}

/**
 * 按路径读取 Blob。先按私有读取（默认上传方式），失败再尝试公开，
 * 兼容 ?public=1 上传的文件。找不到返回 null。
 */
export async function readBlob(pathname: string): Promise<BlobPayload | null> {
  const mocked = await readFromMock(pathname)
  if (mocked) return mocked

  for (const access of ['private', 'public'] as const) {
    try {
      const result = await get(pathname, { access })
      if (!result || result.statusCode === 304 || !result.stream || !result.blob) continue
      return {
        pathname: result.blob.pathname || pathname,
        contentType: result.blob.contentType || 'application/octet-stream',
        size: result.blob.size,
        cacheControl: result.blob.cacheControl || 'private, max-age=0',
        etag: result.blob.etag || '',
        stream: result.stream as unknown as ReadableStream<Uint8Array>,
      }
    } catch {
      // 该 access 下不存在或无权访问，换下一个
    }
  }
  return null
}
