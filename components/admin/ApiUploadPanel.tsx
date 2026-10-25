import { useEffect, useState } from 'react'

interface ApiUploadPanelProps {
  show: boolean
  onToggle: () => void
}

interface ApiInfo {
  endpoint?: string
  downloadEndpoint?: string
  authRequired?: boolean
  auth?: string
  maxFileSizeMB?: number
  examples?: Record<string, string>
}

const FALLBACK_EXAMPLES: Record<string, string> = {
  localPath:
    'curl -X POST "https://<你的域名>/api/v1/upload?localPath=D:\\data\\a.txt&path=notes/a.txt"',
  curlRaw:
    'curl -X POST "https://<你的域名>/api/v1/upload?path=notes/a.txt" \\\n  --data-binary @a.txt',
  curlForm:
    'curl -X POST "https://<你的域名>/api/v1/upload" \\\n  -F "file=@a.txt" -F "folder=notes"',
  powershell:
    'Invoke-RestMethod -Method Post `\n  -Uri "https://<你的域名>/api/v1/upload?localPath=D:\\data\\a.txt&path=notes/a.txt"',
  python:
    'requests.post("https://<你的域名>/api/v1/upload",\n              params={"path": "notes/a.txt"},\n              data=open("a.txt", "rb"))',
  download:
    'curl -OJ "https://<你的域名>/api/download/notes/a.txt"\n# 或\ncurl -OJ "https://<你的域名>/api/download?name=notes/a.txt"',
}

const EXAMPLE_LABELS: Record<string, string> = {
  localPath: '服务器文件路径',
  curlRaw: 'curl · 原始二进制',
  curlForm: 'curl · 表单上传',
  powershell: 'PowerShell · 本地上传',
  python: 'Python · requests',
  download: '下载已上传文件',
}

/** 程序化上传 / 下载 API 说明面板（管理员） */
export default function ApiUploadPanel({ show, onToggle }: ApiUploadPanelProps) {
  const [info, setInfo] = useState<ApiInfo | null>(null)
  const [active, setActive] = useState('localPath')

  useEffect(() => {
    if (!show) return
    let cancelled = false
    fetch('/api/v1/upload')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setInfo(data as ApiInfo)
      })
      .catch(() => {
        if (!cancelled) setInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [show])

  const examples = { ...FALLBACK_EXAMPLES, ...(info?.examples || {}) }
  const origin =
    info?.endpoint?.replace(/\/api\/v1\/upload$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const uploadEndpoint = info?.endpoint || `${origin}/api/v1/upload`
  const downloadEndpoint = info?.downloadEndpoint || `${origin}/api/download/<文件名>`
  const code = examples[active] || FALLBACK_EXAMPLES[active]

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2>
          <i className="fas fa-code"></i> 程序上传 / 下载 API
        </h2>
        <button
          className="btn"
          onClick={onToggle}
          style={{ background: show ? '#666' : '#3b5bff' }}
        >
          <i className="fas fa-terminal"></i> {show ? '隐藏' : '查看用法'}
        </button>
      </div>

      {show && (
        <div style={{ marginTop: '1rem' }}>
          <div className="api-meta">
            <div>
              <span className="api-meta__key">上传</span>
              <code className="api-inline">POST {uploadEndpoint}</code>
            </div>
            <div>
              <span className="api-meta__key">下载</span>
              <code className="api-inline">GET {downloadEndpoint}</code>
            </div>
            <div>
              <span className="api-meta__key">鉴权</span>
              <span>无需 Key，直接调用</span>
            </div>
            <div>
              <span className="api-meta__key">单文件上限</span>
              <span>{info?.maxFileSizeMB || 100} MB</span>
            </div>
            <div>
              <span className="api-meta__key">同名文件</span>
              <span>
                默认不覆盖，加 <code className="api-inline">?overwrite=1</code> 覆盖
              </span>
            </div>
            <div>
              <span className="api-meta__key">本地路径上传</span>
              <span>
                加 <code className="api-inline">?localPath=</code> 直接读服务器上的文件
              </span>
            </div>
          </div>

          <div className="api-tabs">
            {Object.keys(EXAMPLE_LABELS).map((key) => (
              <button
                key={key}
                className={`api-tab${active === key ? ' is-active' : ''}`}
                onClick={() => setActive(key)}
              >
                {EXAMPLE_LABELS[key]}
              </button>
            ))}
          </div>

          <pre className="code-block">
            <code>{code}</code>
          </pre>

          <p className="api-hint">
            四种上传方式：<code className="api-inline">localPath</code> 读服务器本地文件、
            原始二进制、multipart 表单、JSON（base64 或文本）。
            上传返回 <code className="api-inline">pathname</code> 与{' '}
            <code className="api-inline">downloadUrl</code>，下载时直接带上该路径即可。
          </p>
        </div>
      )}
    </div>
  )
}
