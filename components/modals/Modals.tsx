import type { useAdminAuth } from '../../hooks/useAdminAuth'
import type { useAdminTools } from '../../hooks/useAdminTools'

type Auth = ReturnType<typeof useAdminAuth>
type Tools = ReturnType<typeof useAdminTools>

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(24,28,58,0.42)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

/** 全部模态弹窗：登录、命令执行、新建、文件编辑 */
export default function Modals({ auth, tools }: { auth: Auth; tools: Tools }) {
  return (
    <>
      {auth.showLoginModal && (
        <div style={overlay}>
          <div className="modal-glass" style={{ width: '90%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              <i className="fas fa-user-shield"></i> 管理员登录
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>
                用户名
              </label>
              <input
                type="text"
                value={auth.username}
                onChange={(e) => auth.setUsername(e.target.value)}
                placeholder="用户名"
                className="glass-input"
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>
                密码
              </label>
              <input
                type="password"
                value={auth.password}
                onChange={(e) => auth.setPassword(e.target.value)}
                placeholder="密码"
                className="glass-input"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn"
                onClick={auth.closeLoginModal}
                style={{ flex: 1, background: '#666' }}
              >
                取消
              </button>
              <button
                className="btn btn-upload"
                onClick={auth.handleLogin}
                style={{ flex: 1 }}
              >
                登录
              </button>
            </div>
          </div>
        </div>
      )}

      {tools.showCmdModal && (
        <div style={overlay}>
          <div className="modal-glass" style={{ width: '90%', maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              <i className="fas fa-terminal"></i> 命令执行
            </h2>
            {tools.currentDir && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  padding: '0.6rem 1rem',
                  borderRadius: '14px',
                  marginBottom: '1rem',
                  fontFamily: 'monospace',
                  color: '#333',
                  backdropFilter: 'blur(12px) saturate(150%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(150%)',
                }}
              >
                <span style={{ color: '#666' }}>当前目录:</span> {tools.currentDir}
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={tools.command}
                onChange={(e) => tools.setCommand(e.target.value)}
                placeholder="输入命令，如: dir, ipconfig"
                className="glass-input glass-input--flex"
              />
              <button
                className="btn"
                onClick={tools.handleExecuteCommand}
                style={{ background: '#7a4dff' }}
              >
                <i className="fas fa-play"></i> 执行
              </button>
            </div>
            {tools.cmdResult && (
              <div
                style={{
                  background: '#1a1a2e',
                  color: '#00ff00',
                  padding: '1rem',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                <pre>{tools.cmdResult}</pre>
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn"
                onClick={() => {
                  tools.setShowCmdModal(false)
                  tools.setCommand('')
                  tools.setCmdResult('')
                }}
                style={{ flex: 1, background: '#666' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {tools.showCreateModal && (
        <div style={overlay}>
          <div className="modal-glass" style={{ width: '90%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              <i
                className={`fas ${tools.showCreateModal === 'file' ? 'fa-file-plus' : 'fa-folder-plus'}`}
              ></i>
              新建{tools.showCreateModal === 'file' ? '文件' : '目录'}
            </h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>
                名称
              </label>
              <input
                type="text"
                value={tools.newItemName}
                onChange={(e) => tools.setNewItemName(e.target.value)}
                placeholder={`请输入${tools.showCreateModal === 'file' ? '文件' : '目录'}名称`}
                className="glass-input"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn"
                onClick={() => {
                  tools.setShowCreateModal(null)
                  tools.setNewItemName('')
                }}
                style={{ flex: 1, background: '#666' }}
              >
                取消
              </button>
              <button
                className="btn btn-upload"
                onClick={tools.createNewItem}
                style={{ flex: 1 }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {tools.showFileEditor && (
        <div style={overlay}>
          <div
            className="modal-glass"
            style={{ width: '90%', maxWidth: '800px', maxHeight: '80vh' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h2 style={{ color: '#2c3e50' }}>
                <i className="fas fa-file-edit"></i> 编辑文件
              </h2>
              <span
                style={{ color: '#666', fontSize: '0.9rem', fontFamily: 'monospace' }}
              >
                {tools.editingFile}
              </span>
            </div>
            <textarea
              value={tools.editingContent}
              onChange={(e) => tools.setEditingContent(e.target.value)}
              className="glass-input glass-input--area"
              style={{ resize: 'vertical' }}
              placeholder="文件内容..."
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn"
                onClick={() => {
                  tools.setShowFileEditor(false)
                }}
                style={{ flex: 1, background: '#666' }}
              >
                取消
              </button>
              <button
                className="btn btn-upload"
                onClick={tools.saveFile}
                style={{ flex: 1 }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
