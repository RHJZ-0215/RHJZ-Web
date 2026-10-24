import type { RefObject } from 'react'
import type { FileItem, ToastType } from '../../types'
import { downloadUrl } from '../../lib/api'
import { formatSize } from '../../lib/format'

interface FileServerTabProps {
  files: FileItem[]
  isAdmin: boolean
  selectedFileName: string
  message: string
  messageType: ToastType
  fileInputRef: RefObject<HTMLInputElement>
  uploadAreaRef: RefObject<HTMLDivElement>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onUpload: () => void
  onDelete: (filename: string) => void
}

/** 文件服务器：上传卡片 + 下载列表卡片 */
export default function FileServerTab(props: FileServerTabProps) {
  const {
    files, isAdmin, selectedFileName, message, messageType,
    fileInputRef, uploadAreaRef,
    onFileSelect, onDragOver, onDragLeave, onDrop, onUpload, onDelete,
  } = props

  return (
    <div className="file-server-content">
      <div className="main-content">
        <div className="card">
          <h2>
            <i className="fas fa-cloud-upload-alt"></i> 文件上传
          </h2>
          <div
            ref={uploadAreaRef}
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="upload-icon">
              <i className="fas fa-file"></i>
            </div>
            <div className="upload-text">
              <h3>点击或拖放文件到此处</h3>
              <p>支持任意格式文件上传</p>
              {selectedFileName && (
                <p style={{ color: '#3b5bff', fontWeight: '500', marginTop: '0.5rem' }}>
                  已选择: {selectedFileName}
                </p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              id="file-input"
              accept="*"
              onChange={onFileSelect}
            />
          </div>
          <button className="btn btn-upload" onClick={onUpload}>
            <i className="fas fa-upload"></i> 上传文件
          </button>
          {message && <div className={`message ${messageType}`}>{message}</div>}
        </div>

        <div className="card">
          <h2>
            <i className="fas fa-cloud-download-alt"></i> 文件下载
          </h2>
          <p>可下载的文件列表：</p>
          <div className="file-list">
            {files.length > 0 ? (
              files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="file-item">
                  <div className="file-info">
                    <div className="file-icon">
                      <i className="fas fa-file-alt"></i>
                    </div>
                    <div className="file-details">
                      <h4>{file.name}</h4>
                      <div className="file-meta">
                        <span>
                          <i className="fas fa-clock"></i> {file.mtime}
                        </span>
                        <span>
                          <i className="fas fa-hdd"></i> {formatSize(file.size)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <a href={downloadUrl(file.name)} className="btn">
                      <i className="fas fa-download"></i> 下载
                    </a>
                    {isAdmin && (
                      <button
                        className="btn"
                        onClick={() => onDelete(file.name)}
                        style={{ background: '#ff4d5e' }}
                      >
                        <i className="fas fa-trash"></i> 删除
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                <i
                  className="fas fa-folder-open"
                  style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}
                ></i>
                暂无可用文件
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
