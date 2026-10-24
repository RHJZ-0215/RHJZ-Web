#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 命令行上传工具：把本机文件推到文件服务器
//
// 用法：
//   node scripts/upload.mjs <本地文件> [目标路径] [--overwrite] [--public] [--url <地址>]
//
// 环境变量：
//   UPLOAD_API_KEY  上传密钥（与服务器端配置一致）
//   UPLOAD_API_URL  接口地址，默认 http://localhost:3000/api/v1/upload
//
// 示例：
//   node scripts/upload.mjs ./report.pdf docs/2026/report.pdf --overwrite
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

function usage() {
  console.log(`用法: node scripts/upload.mjs <本地文件> [目标路径] [选项]

选项:
  --overwrite        覆盖同名文件
  --public           上传为公开可访问
  --url <地址>       接口地址（默认 $UPLOAD_API_URL 或 http://localhost:3000/api/v1/upload）
  -h, --help         显示帮助

环境变量:
  UPLOAD_API_KEY     上传密钥（服务端配置的 UPLOAD_API_KEY）`)
}

const argv = process.argv.slice(2)
if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
  usage()
  process.exit(argv.length === 0 ? 1 : 0)
}

const flags = new Set(argv.filter((a) => a.startsWith('--')))
const urlIndex = argv.indexOf('--url')
const urlFlag = urlIndex >= 0 ? argv[urlIndex + 1] : ''
const skipIndex = urlIndex >= 0 ? urlIndex + 1 : -1
const positional = argv.filter((a, i) => !a.startsWith('--') && i !== skipIndex)

const localPath = positional[0]
const remotePath = positional[1] || path.basename(localPath)

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

const baseUrl =
  urlFlag || process.env.UPLOAD_API_URL || 'http://localhost:3000/api/v1/upload'
const apiKey = process.env.UPLOAD_API_KEY || ''

const query = new URLSearchParams({ path: remotePath })
if (flags.has('--overwrite')) query.set('overwrite', '1')
if (flags.has('--public')) query.set('public', '1')

const ext = path.extname(localPath).toLowerCase()
const contentType = MIME[ext] || 'application/octet-stream'
const body = fs.readFileSync(localPath)

const headers = { 'Content-Type': contentType }
if (apiKey) headers['X-Api-Key'] = apiKey

console.log(`→ ${localPath} (${stat.size} B) → ${remotePath}`)

try {
  const res = await fetch(`${baseUrl}?${query.toString()}`, { method: 'POST', headers, body })
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
  console.log(`  download : ${data.downloadUrl}`)
} catch (error) {
  console.error(`✗ 请求失败: ${error.message}`)
  process.exit(1)
}
