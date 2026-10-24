// ─────────────────────────────────────────────────────────────
// 文件服务器 · 程序化上传 API（v1）
//
// 一个接口吃三种请求体，方便任意语言/脚本调用：
//   1) multipart/form-data  → 字段名 file（curl -F）
//   2) 原始二进制           → curl --data-binary @本地文件
//   3) JSON + base64/文本    → {"pathname":"a.txt","content":"...","encoding":"base64"}
//
// 认证：环境变量 UPLOAD_API_KEY（可逗号分隔多个），
//       请求头 Authorization: Bearer <key> 或 X-Api-Key: <key>；
//       未配置 Key 时开放上传，并允许管理员 Cookie 直接调用。
// ─────────────────────────────────────────────────────────────

import { put } from '@vercel/blob'
import type { NextApiRequest, NextApiResponse } from 'next'
import { IncomingForm } from 'formidable'
import fs from 'fs/promises'
import { addLog } from '../../../utils/logger'
import { hasConfiguredKey, requireUploadAuth } from '../../../lib/uploadAuth'
import { blobDownloadUrl, guessContentType, normalizePathname } from '../../../lib/blobPath'
import {
  fail,
  firstString,
  getClientIp,
  methodNotAllowed,
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

/** 单文件上限：100MB（Vercel 函数请求体上限 4.5MB，超出请改用分片/直传） */
const MAX_FILE_SIZE = 100 * 1024 * 1024

interface PreparedUpload {
  pathname: string
  body: Buffer | string
  contentType: string
  size: number
}

/** multipart/form-data：取第一个文件字段（不限字段名） */
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

/** 原始二进制：文件名来自 X-Filename 头或 ?path= / ?filename= */
async function parseRawBody(
  req: NextApiRequest,
  queryPath: string,
): Promise<PreparedUpload> {
  const headerName = firstString(req.headers['x-filename'], req.headers['x-file-name'])
  const normalized = normalizePathname(
    queryPath || headerName,
    `uploaded-${Date.now()}.bin`,
    firstString(req.query.folder),
  )
  if (normalized.error) throw new Error(normalized.error)

  const buffer = await readRequestBody(req, MAX_FILE_SIZE)
  const declaredType = firstString(req.headers['content-type'], req.query.contentType)
  const contentType =
    declaredType && declaredType !== 'application/octet-stream'
      ? declaredType
      : guessContentType(normalized.pathname!)

  return { pathname: normalized.pathname!, body: buffer, contentType, size: buffer.length }
}

/** JSON：{"pathname":"docs/a.md","content":"...","encoding":"base64"|"utf8"} */
async function parseJsonBody(req: NextApiRequest): Promise<PreparedUpload> {
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
    firstString(payload.folder),
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
  }
}

/** 接口自描述：GET /api/v1/upload */
function describe(req: NextApiRequest, res: NextApiResponse) {
  const origin = (() => {
    const proto = String(req.headers['x-forwarded-proto'] || 'https')
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
    return `${proto}://${host}`
  })()

  return res.status(200).json({
    status: 'success',
    endpoint: `${origin}/api/v1/upload`,
    methods: ['POST', 'PUT'],
    authRequired: hasConfiguredKey(),
    auth: hasConfiguredKey()
      ? '请求头 Authorization: Bearer <UPLOAD_API_KEY> 或 X-Api-Key: <key>'
      : '未配置 UPLOAD_API_KEY，接口开放；也可用管理员 Cookie 调用',
    maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
    bodyTypes: {
      multipart: '字段名 file（或任意文件字段），可选 pathname / folder 字段',
      raw: '原始二进制 + 请求头 X-Filename: 目标路径，或 ?path= 参数',
      json: '{ "pathname": "a/b.txt", "content": "...", "encoding": "base64" | "utf8" }',
    },
    query: {
      path: '目标路径（含目录），缺省用上传文件名',
      folder: '可选目录前缀',
      overwrite: '1/true 覆盖同名文件，默认 false',
      public: '1/true 上传为公开可访问，默认 private',
    },
    examples: {
      curlRaw: `curl -X POST "${origin}/api/v1/upload?path=notes/a.txt" -H "X-Api-Key: $UPLOAD_API_KEY" --data-binary @a.txt`,
      curlForm: `curl -X POST "${origin}/api/v1/upload" -H "X-Api-Key: $UPLOAD_API_KEY" -F "file=@a.txt" -F "folder=notes"`,
      powershell: `Invoke-RestMethod -Method Post -Uri "${origin}/api/v1/upload?path=notes/a.txt" -Headers @{ "X-Api-Key" = $env:UPLOAD_API_KEY } -InFile a.txt -ContentType "application/octet-stream"`,
      python: `requests.post("${origin}/api/v1/upload", params={"path": "notes/a.txt"}, headers={"X-Api-Key": key}, data=open("a.txt","rb"))`,
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

  const auth = requireUploadAuth(req)
  if (!auth.ok) {
    return fail(res, 401, auth.message || '未授权', { auth: auth.via })
  }

  const queryPath = firstString(req.query.path, req.query.pathname, req.query.filename)
  const overwrite = parseFlag(req.query.overwrite, req.headers['x-overwrite'])
  const isPublic = parseFlag(req.query.public, req.headers['x-public'])
  const contentTypeHeader = String(req.headers['content-type'] || '').toLowerCase()

  let prepared: PreparedUpload
  try {
    if (contentTypeHeader.includes('multipart/form-data')) {
      prepared = await parseMultipart(req)
    } else if (contentTypeHeader.includes('application/json')) {
      prepared = await parseJsonBody(req)
    } else {
      prepared = await parseRawBody(req, queryPath)
    }
  } catch (error: any) {
    const status = error?.httpCode === 413 ? 413 : 400
    const message =
      error?.httpCode === 413
        ? `文件过大，单文件上限 ${MAX_FILE_SIZE / 1024 / 1024}MB`
        : error?.message || '无法解析上传内容'
    return fail(res, status, message)
  }

  // 显式指定 path 时优先使用（覆盖 multipart 里的 pathname 字段）
  if (queryPath && !contentTypeHeader.includes('multipart/form-data')) {
    const normalized = normalizePathname(queryPath, prepared.pathname, firstString(req.query.folder))
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
      details: `文件: ${result.pathname}, 大小: ${prepared.size} bytes, 来源: ${auth.via}`,
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
      auth: auth.via,
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
