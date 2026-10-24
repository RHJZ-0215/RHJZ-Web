import LogsPanel from './LogsPanel'
import ServerFilesPanel from './ServerFilesPanel'
import BlobPanel from './BlobPanel'
import ApiUploadPanel from './ApiUploadPanel'

export interface AdminToolsShape {
  logs: import('../../types').LogRecord[]
  logTypeFilter: string
  showLogs: boolean
  setLogTypeFilter: (t: string) => void
  setShowLogs: (v: boolean) => void
  fetchLogs: (type?: string) => void | Promise<void>

  showServerFiles: boolean
  serverFiles: import('../../types').ServerFile[]
  serverFilesPath: string
  setShowServerFiles: (v: boolean) => void
  fetchServerFiles: (dir?: string) => void | Promise<void>
  navigateToServerDir: (dir: string) => void
  goToParentDir: () => void

  showCreateModal: 'file' | 'directory' | null
  setShowCreateModal: (v: 'file' | 'directory' | null) => void
  openFileEditor: (path: string) => void

  showBlobStorage: boolean
  blobFiles: import('../../types').FileItem[]
  setShowBlobStorage: (v: boolean) => void
  fetchBlobStorage: () => void | Promise<void>

  showApiDocs: boolean
  setShowApiDocs: (v: boolean) => void
}

/** 管理员面板组：日志 + 服务器文件 + Blob 存储 */
export default function AdminPanels({ t }: { t: AdminToolsShape }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <LogsPanel
        show={t.showLogs}
        logs={t.logs}
        activeFilter={t.logTypeFilter}
        onToggle={() => {
          const next = !t.showLogs
          t.setShowLogs(next)
          if (next) t.fetchLogs()
        }}
        onFilter={(type) => {
          t.setLogTypeFilter(type)
          t.fetchLogs(type)
        }}
      />

      <ServerFilesPanel
        show={t.showServerFiles}
        files={t.serverFiles}
        currentPath={t.serverFilesPath}
        onToggle={() => {
          const next = !t.showServerFiles
          t.setShowServerFiles(next)
          if (next) t.fetchServerFiles()
        }}
        onNavigateDir={t.navigateToServerDir}
        onOpenFile={t.openFileEditor}
        onGoParent={t.goToParentDir}
        onCreateFile={() => t.setShowCreateModal('file')}
        onCreateDir={() => t.setShowCreateModal('directory')}
      />

      <BlobPanel
        show={t.showBlobStorage}
        files={t.blobFiles}
        onToggle={() => {
          const next = !t.showBlobStorage
          t.setShowBlobStorage(next)
          if (next) t.fetchBlobStorage()
        }}
      />

      <ApiUploadPanel
        show={t.showApiDocs}
        onToggle={() => t.setShowApiDocs(!t.showApiDocs)}
      />
    </div>
  )
}
