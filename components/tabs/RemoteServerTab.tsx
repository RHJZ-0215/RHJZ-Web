import type { RemoteClient } from '../../types'
import type { useRemoteControl } from '../../hooks/useRemoteControl'

type RC = ReturnType<typeof useRemoteControl>

/** 远程服务端：密码门 + 客户端列表 + 控制面板 */
export default function RemoteServerTab({ rc }: { rc: RC }) {
  if (!rc.authenticated) {
    return (
      <div className="remote-server-content">
        <div className="auth-container">
          <div className="auth-card">
            <h2>
              <i className="fas fa-lock"></i> 远程服务端
            </h2>
            <p>请输入密码以访问远程服务端</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>
                密码
              </label>
              <input
                type="password"
                value={rc.password}
                onChange={(e) => rc.setPassword(e.target.value)}
                placeholder="请输入密码"
                className="glass-input"
                onKeyPress={(e) => e.key === 'Enter' && rc.handleLogin()}
              />
              {rc.passwordError && (
                <p style={{ color: '#ff4d5e', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {rc.passwordError}
                </p>
              )}
            </div>
            <button
              className="btn btn-upload"
              onClick={rc.handleLogin}
              style={{ width: '100%' }}
            >
              <i className="fas fa-unlock"></i> 登录
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="remote-server-content">
      <div className="remote-server-dashboard">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <h2>
            <i className="fas fa-server"></i> 远程服务端
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={rc.fetchClients}
              style={{ background: '#3b5bff' }}
            >
              <i className="fas fa-refresh"></i> 刷新客户端
            </button>
            <a
              className="btn"
              href="/scripts/rhjz-agent.py"
              download
              style={{ background: '#00b894', textDecoration: 'none', color: '#fff' }}
            >
              <i className="fas fa-download"></i> 下载控制脚本
            </a>
            <a
              className="btn"
              href="/scripts/rhjz-cli.py"
              download
              style={{ background: '#7a4dff', textDecoration: 'none', color: '#fff' }}
            >
              <i className="fas fa-terminal"></i> 下载上传/下载CLI
            </a>
            <button
              className="btn"
              onClick={rc.handleLogout}
              style={{ background: '#ff4d5e' }}
            >
              <i className="fas fa-lock"></i> 退出
            </button>
          </div>
        </div>

        <div className="remote-server-main">
          <div className="client-list-container">
            <div className="card client-list-card">
              <h3>
                <i className="fas fa-users"></i> 在线客户端 (
                {rc.clients.filter((c) => c.status === 'online').length}/
                {rc.clients.length})
              </h3>
              <div className="client-list">
                {rc.clients.map((client) => (
                  <ClientRow key={client.id} client={client} rc={rc} />
                ))}
                {rc.clients.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                    暂无在线客户端
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="client-panel-container">
            <div className="client-panel">
              {rc.selectedClient ? (
                <ClientPanels rc={rc} />
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
      </div>
    </div>
  )
}

function ClientRow({ client, rc }: { client: RemoteClient; rc: RC }) {
  return (
    <div
      className={`client-item ${client.status} ${rc.selectedClient?.id === client.id ? 'selected' : ''}`}
    >
      <div className="client-content" onClick={() => rc.selectClient(client)}>
        <div className="client-status">
          <span className={`status-dot ${client.status}`}></span>
          <span className="client-hostname">{client.hostname}</span>
        </div>
        <div className="client-info">
          <span className="client-ip">{client.ip}</span>
          <span className="client-location">
            {client.city}, {client.country}
          </span>
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
          rc.handleRemoveClient(client.id, client.hostname)
        }}
        title="删除客户端"
      >
        <i className="fas fa-trash"></i>
      </button>
    </div>
  )
}

function ClientPanels({ rc }: { rc: RC }) {
  const c = rc.selectedClient!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 客户端信息 */}
      <div className="card client-info-card">
        <h3>
          <i className="fas fa-info-circle"></i> 客户端信息
        </h3>
        <div className="info-grid">
          <InfoItem label="ID" value={c.id} />
          <InfoItem label="IP" value={c.ip} />
          <InfoItem label="国家" value={c.country} />
          <InfoItem label="城市" value={c.city} />
          <InfoItem label="ISP" value={c.isp} />
          <InfoItem label="主机名" value={c.hostname} />
          <InfoItem label="操作系统" value={c.os} />
          <InfoItem label="用户名" value={c.username} />
          <InfoItem label="CPU" value={c.cpu} />
          <InfoItem label="内存" value={c.ram} />
        </div>
      </div>

      {/* 屏幕查看 */}
      <div className="card screen-view-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3>
            <i className="fas fa-desktop"></i> 屏幕查看
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!rc.screenViewActive ? (
              <button
                className="btn"
                onClick={() => rc.startScreenView(c.id)}
                style={{ background: '#00b894' }}
              >
                <i className="fas fa-play"></i> 开始监控
              </button>
            ) : (
              <button
                className="btn"
                onClick={rc.stopScreenView}
                style={{ background: '#ff4d5e' }}
              >
                <i className="fas fa-stop"></i> 停止监控
              </button>
            )}
          </div>
        </div>
        <div className="screen-container">
          {rc.screenshotUrl ? (
            <img
              src={rc.screenshotUrl}
              alt="客户端屏幕"
              className="screen-image"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = ((e.clientX - rect.left) / rect.width) * 1920
                const y = ((e.clientY - rect.top) / rect.height) * 1080
                rc.handleMouseControl(c.id, Math.round(x), Math.round(y), 'click')
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
            onClick={() => rc.handleMouseControl(c.id, 0, 0, 'move')}
            style={{ background: '#95a5a6' }}
          >
            <i className="fas fa-mouse-pointer"></i> 移动鼠标到左上角
          </button>
          <button
            className="btn"
            onClick={() => rc.handleKeyboardControl(c.id, 'enter', 'press')}
            style={{ background: '#95a5a6' }}
          >
            <i className="fas fa-keyboard"></i> 按回车键
          </button>
        </div>
      </div>

      {/* 文件浏览 */}
      <div className="card directory-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3>
            <i className="fas fa-folder-open"></i> 文件浏览
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-sm"
              onClick={rc.handleGoBack}
              disabled={!rc.currentPath}
              style={{
                background: '#95a5a6',
                opacity: !rc.currentPath ? 0.5 : 1,
              }}
            >
              <i className="fas fa-arrow-left"></i> 返回
            </button>
            <button
              className="btn btn-sm"
              onClick={() => rc.getClientDrives(c.id)}
              style={{ background: '#3b5bff' }}
            >
              <i className="fas fa-hard-drive"></i> 驱动器
            </button>
          </div>
        </div>

        {rc.availableDrives.length > 0 && (
          <div className="drive-selector">
            <span style={{ marginRight: '0.5rem', color: '#666' }}>选择驱动器:</span>
            {rc.availableDrives.map((drive) => (
              <button
                key={drive}
                className={`btn btn-sm drive-btn ${rc.currentPath?.startsWith(drive) ? 'active' : ''}`}
                onClick={() => rc.getClientDirectory(c.id, drive)}
              >
                {drive}
              </button>
            ))}
          </div>
        )}

        <div className="path-bar">当前路径: {rc.currentPath || '未选择'}</div>

        <div className="file-browser">
          {rc.directoryItems.map((item, index) => (
            <div key={`${item.name}-${index}`} className="browser-item">
              <i
                className={`fas ${item.type === 'directory' ? 'fa-folder text-orange' : 'fa-file text-blue'}`}
              ></i>
              <span className="item-name">{item.name}</span>
              {item.size && (
                <span className="item-size">{(item.size / 1024).toFixed(2)} KB</span>
              )}
              <div className="item-actions">
                {item.type === 'directory' && (
                  <button
                    className="btn btn-sm primary"
                    onClick={() => rc.getClientDirectory(c.id, item.path)}
                  >
                    <i className="fas fa-folder-open"></i> 进入
                  </button>
                )}
                {item.type === 'file' && (
                  <>
                    <button
                      className="btn btn-sm success"
                      onClick={() => rc.handleExecuteFile(c.id, item.path)}
                    >
                      <i className="fas fa-play"></i> 执行
                    </button>
                    <button
                      className="btn btn-sm info"
                      onClick={() => rc.handleDownloadFile(c.id, item.path)}
                    >
                      <i className="fas fa-download"></i> 下载
                    </button>
                    <button
                      className="btn btn-sm danger"
                      onClick={() =>
                        rc.handleRemoteDeleteFile(c.id, item.path, item.name)
                      }
                    >
                      <i className="fas fa-trash"></i> 删除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {rc.directoryItems.length === 0 && (
            <p style={{ textAlign: 'center', color: '#666', padding: '1rem' }}>
              点击刷新查看目录
            </p>
          )}
        </div>
      </div>

      {/* 命令执行 */}
      <div className="card command-card">
        <h3>
          <i className="fas fa-terminal"></i> 命令执行
        </h3>
        <div className="command-input-group">
          <select
            value={rc.commandType}
            onChange={(e) => rc.setCommandType(e.target.value)}
            className="command-select"
          >
            <option value="cmd">CMD</option>
            <option value="powershell">PowerShell</option>
          </select>
          <input
            type="text"
            value={rc.remoteCommand}
            onChange={(e) => rc.setRemoteCommand(e.target.value)}
            placeholder="输入命令..."
            className="command-input"
            onKeyPress={(e) => e.key === 'Enter' && rc.handleRemoteCmd()}
          />
          <button
            className="btn"
            onClick={rc.handleRemoteCmd}
            style={{ background: '#7a4dff' }}
          >
            <i className="fas fa-play"></i> 执行
          </button>
        </div>
        {rc.commandResult && (
          <div className="command-output">
            <pre>{rc.commandResult}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-item">
      <span className="label">{label}:</span> {value}
    </div>
  )
}
