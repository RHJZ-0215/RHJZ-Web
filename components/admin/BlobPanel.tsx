import type { FileItem } from '../../types'

interface BlobPanelProps {
  show: boolean
  files: FileItem[]
  onToggle: () => void
}

/** Vercel Blob 存储查看面板（管理员） */
export default function BlobPanel({ show, files, onToggle }: BlobPanelProps) {
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
          <i className="fas fa-cloud"></i> Vercel Blob存储查看
        </h2>
        <button
          className="btn"
          onClick={onToggle}
          style={{ background: show ? '#666' : '#3b5bff' }}
        >
          <i className="fas fa-eye"></i> {show ? '隐藏' : '查看存储'}
        </button>
      </div>

      {show && (
        <div style={{ marginTop: '1rem' }}>
          <div className="glass-console">
            {files.length > 0 ? (
              <div>
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="glass-row glass-row--space"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <i
                        className={`fas ${file.name.includes('.') ? 'fa-file' : 'fa-folder'}`}
                        style={{
                          color: file.name.includes('.') ? '#3b5bff' : '#f39c12',
                        }}
                      ></i>
                      <span>{file.name}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        fontSize: '0.8rem',
                        color: '#666',
                      }}
                    >
                      {file.size_str && <span>{file.size_str}</span>}
                      {file.mtime && <span>{file.mtime}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#666' }}>存储为空</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
