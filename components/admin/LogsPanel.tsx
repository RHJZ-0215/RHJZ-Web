import type { LogRecord } from '../../types'
import { LOG_FILTERS, LOG_TYPE_COLORS, LOG_TYPE_NAMES } from '../../lib/format'

interface LogsPanelProps {
  show: boolean
  logs: LogRecord[]
  activeFilter: string
  onToggle: () => void
  onFilter: (type: string) => void
}

/** 系统日志面板（管理员） */
export default function LogsPanel({
  show,
  logs,
  activeFilter,
  onToggle,
  onFilter,
}: LogsPanelProps) {
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
          <i className="fas fa-file-alt"></i> 系统日志
        </h2>
        <button
          className="btn"
          onClick={onToggle}
          style={{ background: show ? '#666' : '#3b5bff' }}
        >
          <i className="fas fa-eye"></i> {show ? '隐藏日志' : '查看日志'}
        </button>
      </div>

      {show && (
        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {LOG_FILTERS.map((type) => (
              <button
                key={type}
                className="btn"
                onClick={() => onFilter(type)}
                style={{
                  background: activeFilter === type ? '#3b5bff' : '#95a5a6',
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.8rem',
                }}
              >
                {LOG_TYPE_NAMES[type]}
              </button>
            ))}
          </div>

          <div className="glass-console mono">
            {logs.length > 0 ? (
              <div>
                {logs.map((log) => {
                  const date = new Date(log.timestamp).toLocaleString('zh-CN')
                  return (
                    <div key={log.id} className="glass-row">
                      <span style={{ color: '#666', whiteSpace: 'nowrap' }}>
                        [{date}]
                      </span>
                      <span
                        style={{
                          color: LOG_TYPE_COLORS[log.type] || '#333',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        [{LOG_TYPE_NAMES[log.type]}]
                      </span>
                      <span style={{ color: '#888', whiteSpace: 'nowrap' }}>
                        {log.ip}
                      </span>
                      <span style={{ fontWeight: '500' }}>{log.action}</span>
                      <span>{log.details}</span>
                      {log.username && (
                        <span style={{ color: '#7a4dff' }}>
                          (用户: {log.username})
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#666' }}>暂无日志记录</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
