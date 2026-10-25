import { useEffect, useState } from 'react'
import BottomTabs from '../components/BottomTabs'
import ThemeToggle from '../components/ThemeToggle'
import Header from '../components/Header'
import HomeTab from '../components/tabs/HomeTab'
import FileServerTab from '../components/tabs/FileServerTab'
import RemoteServerTab from '../components/tabs/RemoteServerTab'
import AdminPanels from '../components/admin/AdminPanels'
import Modals from '../components/modals/Modals'
import { useToast } from '../hooks/useToast'
import { useTheme } from '../hooks/useTheme'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminTools } from '../hooks/useAdminTools'
import { useFileServer } from '../hooks/useFileServer'
import { useRemoteControl } from '../hooks/useRemoteControl'
import { useStableGlass, useModalGlass } from '../hooks/useGlassPanels'
import { deleteFile, trackVisit } from '../lib/api'
import { BOTTOM_TABS } from '../lib/nav'
import type { ActiveTab } from '../types'

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home')

  // 基础：提示 + 主题
  const { message, messageType, showMessage } = useToast()
  const { theme, isDark, toggleTheme } = useTheme()

  // 业务域
  const auth = useAdminAuth(showMessage)
  const tools = useAdminTools(showMessage)
  const fs = useFileServer(showMessage)
  const rc = useRemoteControl(showMessage)

  // 玻璃：常驻 + 弹窗
  useStableGlass()
  useModalGlass([
    auth.showLoginModal,
    tools.showCmdModal,
    tools.showCreateModal,
    tools.showFileEditor,
  ])

  // 首屏：恢复管理员会话 + 记录访问
  useEffect(() => {
    auth.checkAdminStatus()
    trackVisit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 删除文件（确认 + 刷新列表）
  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`确定要删除文件 "${filename}" 吗？`)) return
    try {
      const result = await deleteFile(filename)
      showMessage(
        result.message,
        result.status === 'success' ? 'success' : 'error',
      )
      if (result.status === 'success') fs.fetchFiles()
    } catch {
      showMessage('删除失败', 'error')
    }
  }

  // 首页管理员卡片：进入对应 tab 并展开面板
  const openLogs = () => {
    setActiveTab('fileServer')
    tools.setShowLogs(true)
    tools.fetchLogs()
  }
  const openServerFiles = () => {
    setActiveTab('fileServer')
    tools.setShowServerFiles(true)
    tools.fetchServerFiles()
  }
  const openBlob = () => {
    setActiveTab('fileServer')
    tools.setShowBlobStorage(true)
    tools.fetchBlobStorage()
  }

  return (
    <>
      <div className="aurora-bg" aria-hidden="true" />
      <div className="container">
        <Header
          isAdmin={auth.isAdmin}
          onLogin={() => auth.setShowLoginModal(true)}
          onLogout={auth.handleLogout}
        />

        <div className="tab-content">
          {activeTab === 'home' && (
            <HomeTab
              isAdmin={auth.isAdmin}
              onNavigate={setActiveTab}
              onOpenLogs={openLogs}
              onOpenServerFiles={openServerFiles}
              onOpenBlob={openBlob}
              onOpenCmd={() => tools.setShowCmdModal(true)}
            />
          )}

          {activeTab === 'fileServer' && (
            <>
              <FileServerTab
                files={fs.files}
                isAdmin={auth.isAdmin}
                selectedFileName={fs.selectedFileName}
                message={message}
                messageType={messageType}
                fileInputRef={fs.fileInputRef}
                uploadAreaRef={fs.uploadAreaRef}
                onFileSelect={fs.handleFileSelect}
                onDragOver={fs.handleDragOver}
                onDragLeave={fs.handleDragLeave}
                onDrop={fs.handleDrop}
                onUpload={fs.handleUpload}
                onDelete={handleDeleteFile}
              />
              {auth.isAdmin && <AdminPanels t={{ ...tools }} />}
            </>
          )}

          {activeTab === 'remoteServer' && <RemoteServerTab rc={rc} />}
        </div>

        <BottomTabs
          items={BOTTOM_TABS}
          activeKey={activeTab}
          dark={isDark}
          onChange={(key) => setActiveTab(key as ActiveTab)}
        />

        <ThemeToggle theme={theme} onToggle={toggleTheme} />

        <Modals auth={auth} tools={tools} />
      </div>
    </>
  )
}
