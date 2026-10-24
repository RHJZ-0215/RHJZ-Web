import { useEffect, useState } from 'react'

interface ApiUploadPanelProps {
  show: boolean
  onToggle: () => void
}

interface ApiInfo {
  endpoint?: string
  authRequired?: boolean
  auth?: string
  maxFileSizeMB?: number
  examples?: Record<string, string>
}

const FALLBACK_EXAMPLES: Record<string, string> = {
  curlRaw:
    'curl -X POST "https://<你的域名>/api/v1/upload?path=notes/a.txt" \\\n  -H "X-Api-Key: $UPLOAD_API_KEY" \\\n  --data-binary @a.txt',
  curlForm:
    'curl -X POST "https://<你的域名>/api/v1/upload" \\\n  -H "X-Api-Key: $UPLOAD_API_KEY" \\\n  -F "file=@a.txt" -F "folder=notes"',
  powershell:
    'Invoke-RestMethod -Method Post `\n  -Uri "https://<你的域名>/api/v1/upload?path=notes/a.txt" `\n  -Headers @{ "X-Api-Key" = $env:UPLOAD_API_KEY } `\n  -InFile a.txt -ContentType "application/octet-stream"',
  python:
    'requests.post("https://<你的域名>/api/v1/upload",\n              params={"path": "notes/a.txt"},\n              headers={"X-Api-Key": key},\n              data=open("a.txt", "rb"))',
}

const EXAMPLE_LABELS: Record<string, string> = {
  curlRaw: 'curl · 原始二进制',
  curlForm: 'curl · 表单上传',
  powershell: 'PowerShell · 本地上传',
  python: 'Python · requests',
}

/** 程序化上传 API 说明面板（管理员） */
export default function ApiUploadPanel({ show, onToggle }: ApiUploadPanelProps) {
  const [info, setInfo] = useState<ApiInfo | null>(null)
  const [active, setActive] = useState('curlRaw')

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
  const endpoint = info?.endpoint || `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/upload`
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
          <i className="fas fa-code"></i> 程序上传 API
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
              <span className="api-meta__key">接口</span>
              <code className="api-inline">POST {endpoint}</code>
            </div>
            <div>
              <span className="api-meta__key">鉴权</span>
              <span>
                {info?.authRequired
                  ? '请求头 X-Api-Key 或 Authorization: Bearer <key>'
                  : '未配置 UPLOAD_API_KEY，接口开放（建议配置后使用）'}
              </span>
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
            支持三种请求体：原始二进制、multipart 表单、JSON（base64 或文本）。
            上传完成后返回 <code className="api-inline">pathname</code> 与{' '}
            <code className="api-inline">downloadUrl</code>。
          </p>
        </div>
      )}
    </div>
  )
}
