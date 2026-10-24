# 程序化上传 / 下载 API

让任意程序（脚本、桌面客户端、CI、其它服务）把**指定文件**上传到文件服务器，或按**已上传的文件名**下载回来。
底层读写 Vercel Blob，与网页上传共用同一套存储和文件列表。**全程无需 Key。**

---

## 1. 上传接口

```
POST /api/v1/upload
PUT  /api/v1/upload
GET  /api/v1/upload      # 自描述：返回参数说明与示例
OPTIONS /api/v1/upload   # CORS 预检
```

线上地址：`https://<你的域名>/api/v1/upload`
本地开发：`http://localhost:3000/api/v1/upload`

### 四种上传方式（按需选一种）

| 方式 | 怎么用 | 适用场景 |
| --- | --- | --- |
| **服务器文件路径** | `?localPath=D:\data\a.txt` | 文件已经在服务器/本机同机上，读盘最快 |
| **原始二进制** | 请求体直接放文件字节 + `?path=目标路径` | 脚本/程序直接 POST 字节流 |
| **multipart 表单** | `-F "file=@a.txt"` | curl / 浏览器 / 通用 HTTP 库 |
| **JSON** | `{"pathname":"a.txt","content":"...","encoding":"base64"}` | 文本或小二进制内联进请求 |

`Content-Type` 自动识别：含 `multipart/form-data` 走表单，含 `application/json` 走 JSON，
其余一律按原始字节读取；只要带了 `localPath` 参数，就优先读服务器本地文件（忽略请求体）。

### Query 参数

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `localPath` | **服务器上**的文件路径，如 `D:\data\a.txt`、`/tmp/a.txt`、`~/a.txt` | 无 |
| `path` | 上传到服务器后的目标路径（可含目录），如 `notes/2026/a.txt` | 本地文件名 |
| `pathname` / `filename` | 同 `path` 的别名 | — |
| `folder` | 目录前缀，与文件名拼接 | 无 |
| `overwrite` | `1`/`true` 覆盖同名文件 | `false`（同名报 409） |
| `public` | `1`/`true` 上传为公开可访问 | `false`（私有） |

`localPath` 也接受别名 `?file=` / `?source=`，或请求头 `X-Local-Path`。
注意：`localPath` 指的是**运行服务的那台机器**上的路径；从你自己的电脑上传，请用原始二进制或表单方式。

### 响应

```json
{
  "status": "success",
  "message": "上传成功",
  "pathname": "notes/a.txt",
  "filename": "notes/a.txt",
  "url": "https://<store>.private.blob.vercel-storage.com/notes/a.txt",
  "downloadUrl": "/api/download/notes/a.txt",
  "size": 1024,
  "contentType": "text/plain; charset=utf-8",
  "access": "private",
  "source": "local-path"
}
```

`source` 标明本次实际走的通道：`local-path` / `raw` / `multipart` / `json`。

失败统一为 `{ "status": "error", "message": "...", "details"?: "..." }`：

| 状态码 | 含义 |
| --- | --- |
| 400 | 请求体无法解析 / 路径非法（含 `..`、超长）/ 本地路径是目录 |
| 404 | `localPath` 指向的文件不存在 |
| 403 | `localPath` 没有读取权限 |
| 405 | 方法不支持 |
| 409 | 同名文件已存在（加 `?overwrite=1` 覆盖） |
| 413 | 超过单文件上限（100 MB） |
| 500 | Blob 未配置或存储侧错误 |

---

## 2. 下载接口

```
GET  /api/download/<文件名>             # 多级路径直接跟在后面
GET  /api/download?name=<文件名>        # 查询参数（文件名含特殊字符时更稳）
HEAD /api/download/<文件名>             # 只取响应头
```

无需鉴权，直接按上传时返回的 `pathname` 取文件。响应带
`Content-Disposition: attachment`（加 `?inline=1` 改为浏览器内联预览）、`Content-Length`、`ETag`。

示例：

```bash
curl -OJ "https://<域名>/api/download/notes/a.txt"
curl -OJ "https://<域名>/api/download?name=notes/a.txt"
```

---

## 3. 调用示例

### 服务器本地文件路径（最省事）

```bash
# Linux / macOS
curl -X POST "https://<域名>/api/v1/upload?localPath=/data/a.txt&path=notes/a.txt"

# Windows PowerShell
Invoke-RestMethod -Method Post `
  -Uri "https://<域名>/api/v1/upload?localPath=D:\data\a.txt&path=notes/a.txt"
```

### curl · 原始二进制（从本机上传）

```bash
curl -X POST "https://<域名>/api/v1/upload?path=notes/a.txt" \
  -H "Content-Type: text/plain" \
  --data-binary @./a.txt
```

### curl · 表单上传（可同时指定目录）

```bash
curl -X POST "https://<域名>/api/v1/upload" \
  -F "file=@./a.txt" \
  -F "folder=notes/2026"
```

### PowerShell（Windows 本机）

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://<域名>/api/v1/upload?path=notes/a.txt" `
  -InFile .\a.txt `
  -ContentType "application/octet-stream"
```

### Python

```python
import requests

with open("a.txt", "rb") as fh:
    res = requests.post(
        "https://<域名>/api/v1/upload",
        params={"path": "notes/a.txt", "overwrite": "1"},
        data=fh,
    )
print(res.json())
```

### Node.js

```js
const fs = require('fs')

const res = await fetch('https://<域名>/api/v1/upload?path=notes/a.txt', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: fs.readFileSync('./a.txt'),
})
console.log(await res.json())
```

### JSON（适合把文本/二进制内联进请求）

```bash
curl -X POST "https://<域名>/api/v1/upload" \
  -H "Content-Type: application/json" \
  -d '{"pathname":"docs/hello.md","content":"# Hello","encoding":"utf8"}'
```

### 命令行工具（仓库自带）

```bash
node scripts/upload.mjs ./report.pdf docs/2026/report.pdf --overwrite
node scripts/upload.mjs --download docs/2026/report.pdf --out ./downloads
```

`--url` 或环境变量 `UPLOAD_API_URL` 可指向线上地址，默认 `http://localhost:3000/api/v1/upload`。

---

## 4. 限制与注意

- **单文件 100 MB**：Vercel 函数请求体上限为 **4.5 MB**，超过该值的请求在平台层就会被拒。
  文件已在服务器上时优先用 `?localPath=`（读盘不走请求体）；超大文件建议改用
  `@vercel/blob/client` 直传（本项目暂未开放该通道）。
- 接口**不鉴权**，任何能访问到域名的人都能上传/下载。若要限制，请在 Vercel 侧加访问控制。
- 同名文件默认不覆盖（返回 409），需要覆盖时显式加 `?overwrite=1`。
- `path` 中 `\` 会被归一化为 `/`，`..` 会被拒绝，空段与 `.` 被丢弃。
- 上传/下载都会写入系统日志（`upload` / `download`），可在管理员面板查看。

---

## 5. 面板入口

登录管理员后，进入「文件服务器」标签页，底部有 **「程序上传 / 下载 API」** 卡片，
展示当前实例的上传/下载地址与可复制的调用示例（示例里的域名取自实际访问地址）。
