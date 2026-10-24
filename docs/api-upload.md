# 程序化上传 API

让任意程序（脚本、桌面客户端、CI、其它服务）把**本机文件**上传到文件服务器。
底层写入 Vercel Blob，与网页上传共用同一套存储和文件列表。

---

## 1. 接口

```
POST /api/v1/upload
PUT  /api/v1/upload
GET  /api/v1/upload      # 自描述：返回参数说明与示例
OPTIONS /api/v1/upload   # CORS 预检
```

线上地址：`https://<你的域名>/api/v1/upload`
本地开发：`http://localhost:3000/api/v1/upload`

### Query 参数

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `path` | 目标路径，可含目录，如 `notes/2026/a.txt` | 上传时的文件名 |
| `pathname` / `filename` | 同 `path` 的别名 | — |
| `folder` | 目录前缀，与文件名拼接 | 无 |
| `overwrite` | `1`/`true` 覆盖同名文件 | `false`（同名报 409） |
| `public` | `1`/`true` 上传为公开可访问 | `false`（私有） |

### 三种请求体（按 `Content-Type` 自动识别）

1. **原始二进制** — `Content-Type` 非 json / 非 multipart 时按裸字节读。
   文件名取 `?path=`，或请求头 `X-Filename`。
2. **multipart/form-data** — 任意文件字段名（常用 `file`），可带 `pathname` / `folder` 文本字段。
3. **application/json** — `{ "pathname": "a/b.txt", "content": "...", "encoding": "base64" | "utf8" }`

### 响应

```json
{
  "status": "success",
  "message": "上传成功",
  "pathname": "notes/a.txt",
  "filename": "notes/a.txt",
  "url": "https://<store>.private.blob.vercel-storage.com/notes/a.txt",
  "downloadUrl": "/api/download/notes%2Fa.txt",
  "size": 1024,
  "contentType": "text/plain; charset=utf-8",
  "access": "private",
  "auth": "api-key"
}
```

失败统一为 `{ "status": "error", "message": "...", "details"?: "..." }`：

| 状态码 | 含义 |
| --- | --- |
| 400 | 请求体无法解析 / 路径非法（含 `..`、超长） |
| 401 | 缺少或错误的 API Key |
| 405 | 方法不支持 |
| 409 | 同名文件已存在（加 `?overwrite=1` 覆盖） |
| 413 | 超过单文件上限（100 MB） |
| 500 | Blob 未配置或存储侧错误 |

---

## 2. 鉴权

服务端读取环境变量 `UPLOAD_API_KEY`（支持逗号分隔多个 Key，便于轮换）：

```
UPLOAD_API_KEY=key_one,key_two
```

调用方三选一携带：

```
Authorization: Bearer <key>
X-Api-Key: <key>
?key=<key>          # 不推荐，会进访问日志
```

- **未配置 `UPLOAD_API_KEY` 时接口开放**（与网页上传一致），响应里 `auth: "open"`。
  对外暴露的实例建议务必配置。
- 已登录管理员的浏览器 Cookie（`admin=authenticated`）也可直接调用。

---

## 3. 调用示例

### curl · 原始二进制

```bash
curl -X POST "https://<域名>/api/v1/upload?path=notes/a.txt" \
  -H "X-Api-Key: $UPLOAD_API_KEY" \
  -H "Content-Type: text/plain" \
  --data-binary @./a.txt
```

### curl · 表单上传（可同时指定目录）

```bash
curl -X POST "https://<域名>/api/v1/upload" \
  -H "X-Api-Key: $UPLOAD_API_KEY" \
  -F "file=@./a.txt" \
  -F "folder=notes/2026"
```

### PowerShell（Windows 本机）

```powershell
$env:UPLOAD_API_KEY = 'key_one'
Invoke-RestMethod -Method Post `
  -Uri "https://<域名>/api/v1/upload?path=notes/a.txt" `
  -Headers @{ "X-Api-Key" = $env:UPLOAD_API_KEY } `
  -InFile .\a.txt `
  -ContentType "application/octet-stream"
```

### Python

```python
import os, requests

with open("a.txt", "rb") as fh:
    res = requests.post(
        "https://<域名>/api/v1/upload",
        params={"path": "notes/a.txt", "overwrite": "1"},
        headers={"X-Api-Key": os.environ["UPLOAD_API_KEY"]},
        data=fh,
    )
print(res.json())
```

### Node.js

```js
const fs = require('fs')

const res = await fetch('https://<域名>/api/v1/upload?path=notes/a.txt', {
  method: 'POST',
  headers: { 'X-Api-Key': process.env.UPLOAD_API_KEY, 'Content-Type': 'text/plain' },
  body: fs.readFileSync('./a.txt'),
})
console.log(await res.json())
```

### JSON（适合把文本/二进制内联进请求）

```bash
curl -X POST "https://<域名>/api/v1/upload" \
  -H "X-Api-Key: $UPLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pathname":"docs/hello.md","content":"# Hello","encoding":"utf8"}'
```

---

## 4. 限制与注意

- **单文件 100 MB**：Vercel 函数请求体上限为 **4.5 MB**，超过该值的请求在平台层就会被拒。
  大文件请改用 `@vercel/blob/client` 的浏览器/客户端直传（`handleUpload` 签发 token），
  本项目暂未开放该通道。
- 同名文件默认不覆盖（返回 409），需要覆盖时显式加 `?overwrite=1`。
- `path` 中 `\` 会被归一化为 `/`，`..` 会被拒绝，空段与 `.` 被丢弃。
- 上传会写入系统日志（类型 `upload`，动作「API 文件上传」），可在管理员面板查看。

---

## 5. 面板入口

登录管理员后，进入「文件服务器」标签页，底部新增 **「程序上传 API」** 卡片，
展示当前实例的接口地址、鉴权状态与可复制的调用示例（示例里的域名取自实际访问地址）。
