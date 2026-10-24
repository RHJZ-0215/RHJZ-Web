// ─────────────────────────────────────────────────────────────
// 文件服务器 · 程序化上传 API（v1）· 无需 Key
//
// 四种上传方式，任选其一：
//   1) 指定服务器上的文件路径 → POST /api/v1/upload?localPath=D:\data\a.txt
//   2) 原始二进制            → POST /api/v1/upload?path=notes/a.txt  (body 为文件内容)
//   3) multipart/form-data   → POST /api/v1/upload  -F "file=@a.txt"
//   4) JSON + base64/文本     → {"pathname":"a.txt","content":"...","encoding":"base64"}
//
// 全部无需鉴权，直接调用即可。
// ─────────────────────────────────────────────────────────────

import { put } from '@vercel/blob'
import type { NextApiRequest, NextApiResponse } from 'next'
import { IncomingForm } from 'formidable'
import fs from 'fs/promises'
import { addLog } from '../../../utils/logger'
import { readLocalFile } from '../../../lib/localFile'
import { blobDownloadUrl, guessContentType, normalizePathname } from '../../../lib/blobPath'
import {
  fail,
  firstString,
  getClientIp,
  methodNotAllowed,
  originOf,
  parseFlag,
  readRequestBody,
  setCors,
} from '../../../lib/http'

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '100mb',
  },
}

/** 单文件上限：100MB（Vercel 函数请求体上限 4.5MB，超出请用 localPath 或分片） */
const MAX_FILE_SIZE = 100 * 1024 * 1024

interface PreparedUpload {
  pathname: string
  body: Buffer | string
  contentType: string
  size: number
  source: 'local-path' | 'raw' | 'multipart' | 'json'
}

/** 方式一：直接读取服务器本地文件（最快，不走网络传输） */
async function parseLocalPath(
  localPath: string,
  targetPath: string,
  folder: string,
): Promise<PreparedUpload> {
  const result = await readLocalFile(localPath, MAX_FILE_SIZE)
  if (result.error || !result.buffer) {
    const error: any = new Error(result.error || '读取本地文件失败')
    error.httpCode = result.status || 400
    throw error
  }

  const normalized = normalizePathname(
    targetPath,
    result.filename || `uploaded-${Date.now()}`,
    folder,
  )
  if (normalized.error) {
    const error: any = new Error(normalized.error)
    error.httpCode = 400
    throw error
  }

  return {
    pathname: normalized.pathname!,
    body: result.buffer,
    contentType: guessContentType(normalized.pathname!),
    size: result.buffer.length,
    source: 'local-path',
  }
}

/** 方式二：multipart/form-data，取第一个文件字段（不限字段名） */
function parseMultipart(req: NextApiRequest): Promise<PreparedUpload> {
  const form = new IncomingForm({
    keepExtensions: true,
    maxFileSize: MAX_FILE_SIZE,
    maxTotalFileSize: MAX_FILE_SIZE,
    allowEmptyFiles: true,
    multiples: false,
  })

  return new Promise((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        reject(err)
        return
      }
      let tempPath = ''
      try {
        const fieldValue = (name: string) => {
          const raw = (fields as Record<string, any>)[name]
          if (Array.isArray(raw)) return raw[0] as string
          return typeof raw === 'string' ? raw : ''
        }

        const firstFile = Object.values(files as Record<string, any>)
          .flat()
          .find((item) => item && typeof item === 'object' && 'filepath' in item)

        if (!firstFile) {
          reject(new Error('没有找到文件字段，请使用 -F "file=@本地文件"'))
          return
        }

        const buffer = await fs.readFile(firstFile.filepath)
        tempPath = firstFile.filepath
        const requested =
          fieldValue('pathname') || fieldValue('path') || fieldValue('filename')
        const folder = fieldValue('folder')

        const normalized = normalizePathname(
          requested,
          firstFile.originalFilename || `uploaded-${Date.now()}`,
          folder,
        )
        if (normalized.error) {
          reject(new Error(normalized.error))
          return
        }

        resolve({
          pathname: normalized.pathname!,
          body: buffer,
          contentType: firstFile.mimetype || guessContentType(normalized.pathname!),
          size: buffer.length,
          source: 'multipart',
        })
      } catch (error) {
        reject(error)
      } finally {
        // 清理 formidable 的临时文件，避免占满 /tmp
        if (tempPath) {
          try {
            await fs.unlink(tempPath)
          } catch {
            /* 忽略清理失败 */
          }
        }
      }
    })
  })
}

/** 方式三：原始二进制，文件名来自 ?path= 或 X-Filename 头 */
async function parseRawBody(
  req: NextApiRequest,
  queryPath: string,
  folder: string,
): Promise<PreparedUpload> {
  const headerName = firstString(req.headers['x-filename'], req.headers['x-file-name'])
  const normalized = normalizePathname(
    queryPath || headerName,
    `uploaded-${Date.now()}.bin`,
    folder,
  )
  if (normalized.error) throw new Error(normalized.error)

  const buffer = await readRequestBody(req, MAX_FILE_SIZE)
  const declaredType = firstString(req.headers['content-type'], req.query.contentType)
  const contentType =
    declaredType && declaredType !== 'application/octet-stream'
      ? declaredType
      : guessContentType(normalized.pathname!)

  return {
    pathname: normalized.pathname!,
    body: buffer,
    contentType,
    size: buffer.length,
    source: 'raw',
  }
}

/** 方式四：JSON {"pathname":"a.md","content":"...","encoding":"base64"|"utf8"} */
async function parseJsonBody(req: NextApiRequest, folder: string): Promise<PreparedUpload> {
  const raw = await readRequestBody(req, MAX_FILE_SIZE)
  let payload: any
  try {
    payload = JSON.parse(raw.toString('utf8') || '{}')
  } catch {
    throw new Error('JSON 解析失败，请检查请求体格式')
  }

  const content = payload.content
  if (typeof content !== 'string') {
    throw new Error('JSON 请求体缺少 content 字段（字符串）')
  }

  const normalized = normalizePathname(
    firstString(payload.pathname, payload.path, payload.filename),
    `uploaded-${Date.now()}.txt`,
    firstString(payload.folder) || folder,
  )
  if (normalized.error) throw new Error(normalized.error)

  const encoding = String(payload.encoding || 'utf8').toLowerCase()
  const buffer =
    encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8')

  return {
    pathname: normalized.pathname!,
    body: buffer,
    contentType: firstString(payload.contentType) || guessContentType(normalized.pathname!),
    size: buffer.length,
    source: 'json',
  }
}

/** 接口自描述：GET /api/v1/upload */
function describe(req: NextApiRequest, res: NextApiResponse) {
  const origin = originOf(req)

  return res.status(200).json({
    status: 'success',
    endpoint: `${origin}/api/v1/upload`,
    downloadEndpoint: `${origin}/api/download/<文件名>`,
    methods: ['POST', 'PUT'],
    authRequired: false,
    auth: '无需鉴权，直接调用',
    maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
    uploadModes: {
      localPath: '?localPath=服务器上的文件绝对路径（读服务器本地文件，不经网络传输）',
      raw: '请求体为文件原始字节，文件名用 ?path= 或 X-Filename 头',
      multipart: '表单字段 file=@本地文件，可加 pathname / folder 文本字段',
      json: '{ "pathname": "a/b.txt", "content": "...", "encoding": "base64" | "utf8" }',
    },
    query: {
      localPath: '服务器本地文件路径（也可用 ?file= / ?source= 别名）',
      path: '上传到服务器后的目标路径（含目录）',
      folder: '可选目录前缀',
      overwrite: '1/true 覆盖同名文件，默认 false',
      public: '1/true 上传为公开可访问，默认 private',
    },
    examples: {
      localPath: `curl -X POST "${origin}/api/v1/upload?localPath=D%3A%5Cdata%5Ca.txt&path=notes/a.txt"`,
      curlRaw: `curl -X POST "${origin}/api/v1/upload?path=notes/a.txt" --data-binary @a.txt`,
      curlForm: `curl -X POST "${origin}/api/v1/upload" -F "file=@a.txt" -F "folder=notes"`,
      powershell: `Invoke-RestMethod -Method Post -Uri "${origin}/api/v1/upload?localPath=D:\\data\\a.txt&path=notes/a.txt"`,
      python: `requests.post("${origin}/api/v1/upload", params={"path": "notes/a.txt"}, data=open("a.txt","rb"))`,
      download: `curl -OJ "${origin}/api/download/notes/a.txt"`,
    },
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return describe(req, res)
  }
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'OPTIONS'])
  }

  const localPath = firstString(
    req.query.localPath,
    req.query.localpath,
    req.query.file,
    req.query.source,
    req.headers['x-local-path'],
  )
  const queryPath = firstString(req.query.path, req.query.pathname, req.query.filename)
  const folder = firstString(req.query.folder)
  const overwrite = parseFlag(req.query.overwrite, req.headers['x-overwrite'])
  const isPublic = parseFlag(req.query.public, req.headers['x-public'])
  const contentTypeHeader = String(req.headers['content-type'] || '').toLowerCase()

  let prepared: PreparedUpload
  try {
    if (localPath) {
      // 方式一：服务器本地路径优先（忽略请求体）
      prepared = await parseLocalPath(localPath, queryPath, folder)
    } else if (contentTypeHeader.includes('multipart/form-data')) {
      prepared = await parseMultipart(req)
    } else if (contentTypeHeader.includes('application/json')) {
      prepared = await parseJsonBody(req, folder)
    } else {
      prepared = await parseRawBody(req, queryPath, folder)
    }
  } catch (error: any) {
    const status = error?.httpCode === 413 ? 413 : error?.httpCode || 400
    const message =
      error?.httpCode === 413
        ? `文件过大，单文件上限 ${MAX_FILE_SIZE / 1024 / 1024}MB`
        : error?.message || '无法解析上传内容'
    return fail(res, status, message)
  }

  // 显式指定 path 时优先使用（覆盖 multipart 里的 pathname 字段）
  if (queryPath && !contentTypeHeader.includes('multipart/form-data') && !localPath) {
    const normalized = normalizePathname(queryPath, prepared.pathname, folder)
    if (normalized.error) return fail(res, 400, normalized.error)
    prepared.pathname = normalized.pathname!
  }

  try {
    const result = await put(prepared.pathname, prepared.body, {
      access: isPublic ? 'public' : 'private',
      contentType: prepared.contentType,
      allowOverwrite: overwrite,
      addRandomSuffix: false,
    })

    await addLog({
      ip: getClientIp(req),
      type: 'upload',
      action: 'API 文件上传',
      details: `文件: ${result.pathname}, 大小: ${prepared.size} bytes, 方式: ${prepared.source}`,
    })

    return res.status(200).json({
      status: 'success',
      message: overwrite ? '上传成功（已覆盖同名文件）' : '上传成功',
      pathname: result.pathname,
      filename: result.pathname,
      url: result.url,
      downloadUrl: blobDownloadUrl(result.pathname),
      size: prepared.size,
      contentType: result.contentType || prepared.contentType,
      access: isPublic ? 'public' : 'private',
      source: prepared.source,
    })
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.includes('BLOB_READ_WRITE_TOKEN') || message.includes('No token found')) {
      return fail(res, 500, '存储配置未完成', {
        details: '请在 Vercel 控制台启用 Blob 存储并配置 BLOB_READ_WRITE_TOKEN',
      })
    }
    if (message.includes('already exists')) {
      return fail(res, 409, '同名文件已存在', {
        details: '加 ?overwrite=1 覆盖，或改用 ?path= 指定其它路径',
      })
    }
    if (message.includes('pathname')) {
      return fail(res, 400, '目标路径不合法', { details: message })
    }
    console.error('API upload error:', error)
    return fail(res, 500, '上传失败', { details: message || '未知错误' })
  }
}
