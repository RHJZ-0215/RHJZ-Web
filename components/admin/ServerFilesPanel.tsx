import type { ServerFile } from '../../types'
import { formatSize } from '../../lib/format'

interface ServerFilesPanelProps {
  show: boolean
  files: ServerFile[]
  currentPath: string
  onToggle: () => void
  onNavigateDir: (dir: string) => void
  onOpenFile: (path: string) => void
  onGoParent: () => void
  onCreateFile: () => void
  onCreateDir: () => void
}

/** 服务器本地文件浏览面板（管理员） */
export default function ServerFilesPanel({
  show,
  files,
  currentPath,
  onToggle,
  onNavigateDir,
  onOpenFile,
  onGoParent,
  onCreateFile,
  onCreateDir,
}: ServerFilesPanelProps) {
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
          <i className="fas fa-server"></i> 服务器文件浏览
        </h2>
        <button
          className="btn"
          onClick={onToggle}
          style={{ background: show ? '#666' : '#3b5bff' }}
        >
          <i className="fas fa-folder-open"></i> {show ? '隐藏' : '浏览文件'}
        </button>
      </div>

      {show && (
        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: '#666', fontSize: '0.9rem' }}>当前路径:</span>
            <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace' }}>
              {currentPath}
            </span>
            {currentPath !== '.' && (
              <button
                className="btn"
                onClick={onGoParent}
                style={{
                  background: '#95a5a6',
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.8rem',
                }}
              >
                <i className="fas fa-arrow-up"></i> 返回上级
              </button>
            )}
            <button
              className="btn"
              onClick={onCreateFile}
              style={{
                background: '#00b894',
                padding: '0.3rem 0.8rem',
                fontSize: '0.8rem',
              }}
            >
              <i className="fas fa-file-plus"></i> 新建文件
            </button>
            <button
              className="btn"
              onClick={onCreateDir}
              style={{
                background: '#f39c12',
                padding: '0.3rem 0.8rem',
                fontSize: '0.8rem',
              }}
            >
              <i className="fas fa-folder-plus"></i> 新建目录
            </button>
          </div>

          <div className="glass-console">
            {files.length > 0 ? (
              <div>
                {files.map((file) => (
                  <div
                    key={file.path}
                    className="glass-row glass-row--space"
                    onClick={() => file.type === 'directory' && onNavigateDir(file.path)}
                    onDoubleClick={() => file.type === 'file' && onOpenFile(file.path)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <i
                        className={`fas ${file.type === 'directory' ? 'fa-folder' : 'fa-file'}`}
                        style={{
                          color: file.type === 'directory' ? '#f39c12' : '#3b5bff',
                        }}
                      ></i>
                      <span>{file.name}</span>
                      {file.type === 'file' && (
                        <span style={{ color: '#95a5a6', fontSize: '0.8rem' }}>
                          (双击编辑)
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        fontSize: '0.8rem',
                        color: '#666',
                      }}
                    >
                      {file.size !== undefined && (
                        <span>{formatSize(file.size)}</span>
                      )}
                      {file.mtime && <span>{file.mtime}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#666' }}>目录为空</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
