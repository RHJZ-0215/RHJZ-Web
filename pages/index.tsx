import { useState, useEffect, useRef } from 'react'

interface FileItem {
  name: string
  size: number
  size_str: string
  mtime: string
  url?: string
}

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showCmdModal, setShowCmdModal] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [command, setCommand] = useState('')
  const [cmdResult, setCmdResult] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAreaRef = useRef<HTMLDivElement>(null)

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files')
      if (!response.ok) {
        console.error('Failed to fetch files:', response.status)
        setFiles([])
        return
      }
      const data = await response.json()
      if (!data || !Array.isArray(data.files)) {
        setFiles([])
        return
      }
      setFiles(data.files)
    } catch (error) {
      console.error('Failed to fetch files:', error)
      setFiles([])
    }
  }

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/admin/status')
      const data = await response.json()
      setIsAdmin(data.isAdmin)
    } catch (error) {
      console.error('Failed to check admin status:', error)
    }
  }

  useEffect(() => {
    fetchFiles()
    checkAdminStatus()
  }, [])

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => {
      setMessage('')
      setMessageType('')
    }, 3000)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFileName(e.target.files[0].name)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (uploadAreaRef.current) {
      uploadAreaRef.current.style.borderColor = '#3498db'
      uploadAreaRef.current.style.backgroundColor = '#f0f5ff'
    }
  }

  const handleDragLeave = () => {
    if (uploadAreaRef.current) {
      uploadAreaRef.current.style.borderColor = '#d1d9e6'
      uploadAreaRef.current.style.backgroundColor = '#f8fafc'
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (uploadAreaRef.current) {
      uploadAreaRef.current.style.borderColor = '#d1d9e6'
      uploadAreaRef.current.style.backgroundColor = '#f8fafc'
    }
    if (e.dataTransfer.files.length > 0 && fileInputRef.current) {
      fileInputRef.current.files = e.dataTransfer.files
      setSelectedFileName(e.dataTransfer.files[0].name)
    }
  }

  const handleUpload = async () => {
    if (!fileInputRef.current || !fileInputRef.current.files || fileInputRef.current.files.length === 0) {
      showMessage('请先选择文件', 'error')
      return
    }

    const formData = new FormData()
    formData.append('file', fileInputRef.current.files[0])

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        showMessage(`上传失败，状态码: ${response.status}`, 'error')
        return
      }
      
      const result = await response.json()
      
      if (!result || typeof result.status !== 'string' || typeof result.message !== 'string') {
        showMessage('上传失败，响应格式错误', 'error')
        return
      }
      
      showMessage(result.message, result.status === 'success' ? 'success' : 'error')
      
      if (result.status === 'success') {
        setSelectedFileName('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        fetchFiles()
      }
    } catch (error) {
      showMessage('上传失败，请重试', 'error')
    }
  }

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const result = await response.json()
      showMessage(result.message, result.status === 'success' ? 'success' : 'error')
      if (result.status === 'success') {
        setIsAdmin(true)
        setShowLoginModal(false)
        setUsername('')
        setPassword('')
      }
    } catch (error) {
      showMessage('登录失败', 'error')
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
      })
      const result = await response.json()
      showMessage(result.message, result.status === 'success' ? 'success' : 'error')
      if (result.status === 'success') {
        setIsAdmin(false)
      }
    } catch (error) {
      showMessage('退出失败', 'error')
    }
  }

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`确定要删除文件 "${filename}" 吗？`)) {
      return
    }
    try {
      const response = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      })
      const result = await response.json()
      showMessage(result.message, result.status === 'success' ? 'success' : 'error')
      if (result.status === 'success') {
        fetchFiles()
      }
    } catch (error) {
      showMessage('删除失败', 'error')
    }
  }

  const handleExecuteCommand = async () => {
    if (!command.trim()) {
      showMessage('请输入命令', 'error')
      return
    }
    try {
      const response = await fetch('/api/admin/cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const result = await response.json()
      let output = ''
      if (result.stdout) output += `标准输出:\n${result.stdout}\n\n`
      if (result.stderr) output += `错误输出:\n${result.stderr}`
      setCmdResult(output || result.message)
      showMessage(result.message, result.status === 'success' ? 'success' : 'error')
    } catch (error) {
      showMessage('命令执行失败', 'error')
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>文件上传下载系统—Made By：君卓</h1>
            <p>君卓下载库</p>
          </div>
          {isAdmin ? (
            <button className="btn btn-logout" onClick={handleLogout} style={{ background: '#e74c3c' }}>
              <i className="fas fa-sign-out-alt"></i> 退出管理员
            </button>
          ) : (
            <button className="btn btn-login" onClick={() => setShowLoginModal(true)} style={{ background: '#9b59b6' }}>
              <i className="fas fa-user-shield"></i> 登录管理员
            </button>
          )}
        </div>
      </header>

      <div className="main-content">
        <div className="card">
          <h2>
            <i className="fas fa-cloud-upload-alt"></i> 文件上传
          </h2>
          <div
            ref={uploadAreaRef}
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <i className="fas fa-file"></i>
            </div>
            <div className="upload-text">
              <h3>点击或拖放文件到此处</h3>
              <p>支持任意格式文件上传</p>
              {selectedFileName && (
                <p style={{ color: '#3498db', fontWeight: '500', marginTop: '0.5rem' }}>
                  已选择: {selectedFileName}
                </p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              id="file-input"
              accept="*"
              onChange={handleFileSelect}
            />
          </div>
          <button className="btn btn-upload" onClick={handleUpload}>
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
                    <a href={`/api/download/${encodeURIComponent(file.name)}`} className="btn">
                      <i className="fas fa-download"></i> 下载
                    </a>
                    {isAdmin && (
                      <button 
                        className="btn" 
                        onClick={() => handleDeleteFile(file.name)}
                        style={{ background: '#e74c3c' }}
                      >
                        <i className="fas fa-trash"></i> 删除
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                <i className="fas fa-folder-open" style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}></i>
                暂无可用文件
              </p>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2>
            <i className="fas fa-terminal"></i> 命令执行（管理员）
          </h2>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="输入命令，如: dir, ipconfig"
              style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
            />
            <button className="btn" onClick={handleExecuteCommand} style={{ background: '#9b59b6' }}>
              <i className="fas fa-play"></i> 执行
            </button>
          </div>
          {cmdResult && (
            <div style={{ 
              background: '#1a1a2e', 
              color: '#00ff00', 
              padding: '1rem', 
              borderRadius: '6px', 
              fontFamily: 'monospace',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <pre>{cmdResult}</pre>
            </div>
          )}
        </div>
      )}

      {showLoginModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000 
        }}>
          <div style={{ 
            background: 'white', 
            padding: '2rem', 
            borderRadius: '12px', 
            width: '90%', 
            maxWidth: '400px' 
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              <i className="fas fa-user-shield"></i> 管理员登录
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn" 
                onClick={() => { setShowLoginModal(false); setUsername(''); setPassword('') }}
                style={{ flex: 1, background: '#666' }}
              >
                取消
              </button>
              <button 
                className="btn btn-upload" 
                onClick={handleLogin}
                style={{ flex: 1 }}
              >
                登录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}