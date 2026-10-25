#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 命令行工具：把本机文件上传到文件服务器（无需 Key），或下载已上传的文件
//
// 上传（三种写法等价）：
//   node scripts/upload.mjs UPLOADFILE="D:\desktop\notes\a.txt"
//   UPLOADFILE="D:\desktop\notes\a.txt" node scripts/upload.mjs     (bash)
//   $env:UPLOADFILE='D:\desktop\notes\a.txt'; node scripts/upload.mjs (PowerShell)
//
// 也可直接给路径：
//   node scripts/upload.mjs D:\desktop\notes\a.txt notes/a.txt --overwrite
//
// 下载：
//   node scripts/upload.mjs --download notes/a.txt --out .\downloads
//
// 可用的 KEY=VALUE 参数：
//   UPLOADFILE=<本机文件路径>    要上传的文件（必填）
//   UPLOADPATH=<目标路径>        上传后保存的路径，默认取文件名
//   OVERWRITE=1                  覆盖同名文件
//   PUBLIC=1                     上传为公开可访问
//   UPLOAD_API_URL=<地址>        上传接口地址
//   UPLOAD_BASE_URL=<地址>       站点根地址（下载用）
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const MIME = {
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

const DEFAULT_UPLOAD_URL = 'http://localhost:3000/api/v1/upload'

function usage() {
  console.log(`用法:
  上传: node scripts/upload.mjs UPLOADFILE="<本机文件路径>" [UPLOADPATH=<目标路径>] [--overwrite] [--public]
  下载: node scripts/upload.mjs --download <文件名> [--out <保存目录>]

示例:
  node scripts/upload.mjs UPLOADFILE="D:\\desktop\\notes\\a.txt"
  node scripts/upload.mjs UPLOADFILE="D:\\desktop\\notes\\a.txt" UPLOADPATH=notes/a.txt OVERWRITE=1
  node scripts/upload.mjs --download notes/a.txt --out .\\downloads

选项:
  --overwrite        覆盖同名文件
  --public           上传为公开可访问
  --url <地址>       接口地址（默认 $UPLOAD_API_URL 或 ${DEFAULT_UPLOAD_URL}）
  --download <文件名> 下载模式，按已上传的文件名取回
  --out <目录>       下载保存目录（默认当前目录）
  -h, --help         显示帮助

环境变量（与 KEY=VALUE 参数等价）:
  UPLOADFILE         本机文件路径
  UPLOADPATH         上传后的目标路径
  UPLOAD_API_URL     上传接口地址
  UPLOAD_BASE_URL    站点根地址（下载用，默认由上传地址推导）`)
}

const argv = process.argv.slice(2)
if (argv.includes('-h') || argv.includes('--help')) {
  usage()
  process.exit(0)
}

/** 去掉可能残留的首尾引号 */
function unquote(value) {
  const trimmed = String(value).trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/** 把 KEY=VALUE 形式的参数拆出来，其余当作普通参数 */
const kv = {}
const plain = []
for (const arg of argv) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(arg)
  if (match) {
    kv[match[1].toUpperCase()] = unquote(match[2])
  } else {
    plain.push(arg)
  }
}

/** 取 --name 后面那个参数（也支持 --name=value） */
function valueOf(name) {
  const inline = plain.find((a) => a.startsWith(name + '='))
  if (inline) return inline.slice(name.length + 1)
  const i = plain.indexOf(name)
  return i >= 0 && plain[i + 1] && !plain[i + 1].startsWith('--') ? plain[i + 1] : ''
}

const flags = new Set(plain.filter((a) => a.startsWith('--')))
const positional = plain.filter((a, i) => {
  if (a.startsWith('--')) return false
  const prev = plain[i - 1]
  return !(prev === '--url' || prev === '--download' || prev === '--out')
})

const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())

const uploadUrl =
  valueOf('--url') ||
  kv.UPLOAD_API_URL ||
  process.env.UPLOAD_API_URL ||
  DEFAULT_UPLOAD_URL
const baseUrl =
  kv.UPLOAD_BASE_URL ||
  process.env.UPLOAD_BASE_URL ||
  uploadUrl.replace(/\/api\/v1\/upload\/?$/, '')

// ── 下载模式 ──
const downloadName = valueOf('--download')
if (downloadName) {
  const outDir = valueOf('--out') || kv.OUT || '.'
  const encoded = downloadName
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  const url = `${baseUrl}/api/download/${encoded}`

  console.log(`↓ ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`✗ 下载失败 (${res.status}): ${body.slice(0, 200)}`)
      process.exit(1)
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.mkdirSync(outDir, { recursive: true })
    const savePath = path.join(outDir, path.basename(downloadName))
    fs.writeFileSync(savePath, buffer)
    console.log(`✓ 已保存: ${savePath} (${buffer.length} B)`)
  } catch (error) {
    console.error(`✗ 请求失败: ${error.message}`)
    process.exit(1)
  }
  process.exit(0)
}

// ── 上传模式 ──
const localPath = kv.UPLOADFILE || process.env.UPLOADFILE || positional[0] || ''
if (!localPath) {
  console.error('✗ 请用 UPLOADFILE="<本机文件路径>" 指定要上传的文件\n')
  usage()
  process.exit(1)
}

const remotePath =
  kv.UPLOADPATH ||
  kv.PATH ||
  process.env.UPLOADPATH ||
  positional[1] ||
  path.basename(localPath)

const overwrite = flags.has('--overwrite') || truthy(kv.OVERWRITE || '')
const isPublic = flags.has('--public') || truthy(kv.PUBLIC || '')

if (!fs.existsSync(localPath)) {
  console.error(`✗ 文件不存在: ${localPath}`)
  process.exit(1)
}
const stat = fs.statSync(localPath)
if (!stat.isFile()) {
  console.error(`✗ 不是普通文件: ${localPath}`)
  process.exit(1)
}

const query = new URLSearchParams({ path: remotePath })
if (overwrite) query.set('overwrite', '1')
if (isPublic) query.set('public', '1')

const ext = path.extname(localPath).toLowerCase()
const contentType = MIME[ext] || 'application/octet-stream'
const body = fs.readFileSync(localPath)

console.log(`→ ${localPath} (${stat.size} B) → ${remotePath}`)

try {
  const res = await fetch(`${uploadUrl}?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.status !== 'success') {
    console.error(`✗ 上传失败 (${res.status}): ${data.message || '未知错误'}`)
    if (data.details) console.error(`  ${data.details}`)
    process.exit(1)
  }

  console.log('✓ 上传成功')
  console.log(`  pathname : ${data.pathname}`)
  console.log(`  size     : ${data.size} B`)
  console.log(`  type     : ${data.contentType}`)
  console.log(`  access   : ${data.access}`)
  console.log(`  下载地址 : ${baseUrl}${data.downloadUrl}`)
} catch (error) {
  console.error(`✗ 请求失败: ${error.message}`)
  process.exit(1)
}
