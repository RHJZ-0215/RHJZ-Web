import type { ActiveTab } from '../../types'

interface HomeTabProps {
  isAdmin: boolean
  onNavigate: (tab: ActiveTab) => void
  onOpenLogs: () => void
  onOpenServerFiles: () => void
  onOpenBlob: () => void
  onOpenCmd: () => void
}

/** 首页：Hero + 功能卡片 + 管理员入口 */
export default function HomeTab({
  isAdmin,
  onNavigate,
  onOpenLogs,
  onOpenServerFiles,
  onOpenBlob,
  onOpenCmd,
}: HomeTabProps) {
  return (
    <div className="home-content">
      <div className="hero-section">
        <h2>欢迎来到君卓博客</h2>
        <p>探索更多功能和服务</p>
      </div>

      <div className="features-grid">
        <div className="feature-card" onClick={() => onNavigate('fileServer')}>
          <div className="feature-icon">
            <i className="fas fa-cloud-upload-alt"></i>
          </div>
          <h3>文件上传下载服务器</h3>
          <p>安全、便捷的文件管理服务</p>
        </div>

        <div className="feature-card" onClick={() => onNavigate('remoteServer')}>
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
            <div className="admin-card" onClick={onOpenLogs}>
              <i className="fas fa-file-alt"></i>
              <span>系统日志</span>
            </div>
            <div className="admin-card" onClick={onOpenServerFiles}>
              <i className="fas fa-folder-open"></i>
              <span>服务器文件</span>
            </div>
            <div className="admin-card" onClick={onOpenBlob}>
              <i className="fas fa-cloud"></i>
              <span>Blob存储</span>
            </div>
            <div className="admin-card" onClick={onOpenCmd}>
              <i className="fas fa-terminal"></i>
              <span>命令执行</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
