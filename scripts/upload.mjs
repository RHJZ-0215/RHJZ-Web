#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 命令行工具：上传本地文件 / 下载已上传文件（无需 Key）
//
// 上传：
//   node scripts/upload.mjs <本地文件> [目标路径] [--overwrite] [--public] [--url <地址>]
// 下载：
//   node scripts/upload.mjs --download <文件名> [--out <保存目录>] [--url <地址>]
//
// 环境变量：
//   UPLOAD_API_URL  上传接口地址，默认 http://localhost:3000/api/v1/upload
//   UPLOAD_BASE_URL 站点根地址，用于下载，默认由上传地址推导
//
// 示例：
//   node scripts/upload.mjs ./report.pdf docs/2026/report.pdf --overwrite
//   node scripts/upload.mjs --download docs/2026/report.pdf --out ./downloads
//   UPLOAD_API_URL=https://rhjz-web.vercel.app/api/v1/upload node scripts/upload.mjs a.txt
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
  上传: node scripts/upload.mjs <本地文件> [目标路径] [选项]
  下载: node scripts/upload.mjs --download <文件名> [--out <保存目录>] [选项]

选项:
  --overwrite        覆盖同名文件
  --public           上传为公开可访问
  --url <地址>       接口地址（默认 $UPLOAD_API_URL 或 ${DEFAULT_UPLOAD_URL}）
  --download <文件名> 下载模式，按已上传的文件名取回
  --out <目录>       下载保存目录（默认当前目录）
  -h, --help         显示帮助

环境变量:
  UPLOAD_API_URL     上传接口地址
  UPLOAD_BASE_URL    站点根地址（下载用，默认由上传地址推导）`)
}

const argv = process.argv.slice(2)
if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
  usage()
  process.exit(argv.length === 0 ? 1 : 0)
}

/** 取 --name 后面那个参数的下标 */
function valueIndexOf(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? i + 1 : -1
}

const skipIndexes = new Set(
  ['--url', '--download', '--out'].map(valueIndexOf).filter((i) => i > 0),
)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const positional = argv.filter((a, i) => !a.startsWith('--') && !skipIndexes.has(i))

const uploadUrl =
  (valueIndexOf('--url') > 0 ? argv[valueIndexOf('--url')] : '') ||
  process.env.UPLOAD_API_URL ||
  DEFAULT_UPLOAD_URL
const baseUrl =
  process.env.UPLOAD_BASE_URL || uploadUrl.replace(/\/api\/v1\/upload\/?$/, '')

// ── 下载模式 ──
const downloadIndex = valueIndexOf('--download')
if (downloadIndex > 0) {
  const filename = argv[downloadIndex]
  if (!filename) {
    console.error('✗ 缺少要下载的文件名')
    process.exit(1)
  }
  const outDir = (valueIndexOf('--out') > 0 ? argv[valueIndexOf('--out')] : '') || '.'
  const encoded = filename
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
    const savePath = path.join(outDir, path.basename(filename))
    fs.writeFileSync(savePath, buffer)
    console.log(`✓ 已保存: ${savePath} (${buffer.length} B)`)
  } catch (error) {
    console.error(`✗ 请求失败: ${error.message}`)
    process.exit(1)
  }
  process.exit(0)
}

// ── 上传模式 ──
const localPath = positional[0]
const remotePath = positional[1] || (localPath ? path.basename(localPath) : '')

if (!localPath) {
  usage()
  process.exit(1)
}
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
if (flags.has('--overwrite')) query.set('overwrite', '1')
if (flags.has('--public')) query.set('public', '1')

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

  console.log(`✓ 上传成功`)
  console.log(`  pathname : ${data.pathname}`)
  console.log(`  size     : ${data.size} B`)
  console.log(`  type     : ${data.contentType}`)
  console.log(`  access   : ${data.access}`)
  console.log(`  download : ${baseUrl}${data.downloadUrl}`)
} catch (error) {
  console.error(`✗ 请求失败: ${error.message}`)
  process.exit(1)
}
