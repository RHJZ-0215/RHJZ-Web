import { useCallback, useRef, useState } from 'react'
import {
  getClientScreenshotUrl,
  getRemoteResult,
  listClients,
  removeClient,
  sendRemoteCommand as apiSendCommand,
} from '../lib/api'
import type { RemoteClient, RemoteFsItem } from '../types'

type ShowMessage = (text: string, type: 'success' | 'error') => void

const REMOTE_PASSWORD = 'rhjz'

/**
 * 远程服务端：前端密码门 + 客户端列表 + 屏幕监控 +
 * 文件浏览 + 鼠标/键盘/命令控制。
 */
export function useRemoteControl(showMessage: ShowMessage) {
  // 密码门
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // 客户端
  const [clients, setClients] = useState<RemoteClient[]>([])
  const [selectedClient, setSelectedClient] = useState<RemoteClient | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [screenViewActive, setScreenViewActive] = useState(false)

  // 文件系统
  const [directoryItems, setDirectoryItems] = useState<RemoteFsItem[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [availableDrives, setAvailableDrives] = useState<string[]>([])

  // 命令
  const [remoteCommand, setRemoteCommand] = useState('')
  const [commandResult, setCommandResult] = useState('')
  const [commandType, setCommandType] = useState('cmd')

  const screenViewActiveRef = useRef(false)
  const screenViewTimerRef = useRef<number | null>(null)

  // ── 密码门 ──
  const handleLogin = () => {
    if (password === REMOTE_PASSWORD) {
      setAuthenticated(true)
      setPasswordError('')
    } else {
      setPasswordError('密码错误，请输入正确的密码')
    }
  }

  const handleLogout = () => {
    setAuthenticated(false)
    setPassword('')
    setPasswordError('')
  }

  // ── 客户端列表 ──
  const fetchClients = useCallback(async () => {
    setClients(await listClients())
  }, [])

  // ── 命令通道（底层） ──
  const sendCommand = useCallback(
    async (clientId: string, command: string, type: string) => {
      try {
        const result = await apiSendCommand(clientId, command, type)
        if (result.status === 'success') {
          showMessage('命令已发送', 'success')
          return result.commandId as string
        }
      } catch {
        showMessage('命令发送失败', 'error')
      }
      return null
    },
    [showMessage],
  )

  const fetchResultText = useCallback(
    async (clientId: string, commandId?: string) => {
      try {
        const result = await getRemoteResult(clientId, commandId)
        return result ? result.output || result.message || '' : ''
      } catch {
        return ''
      }
    },
    [],
  )

  // ── 截图 ──
  const fetchScreenshot = useCallback(
    async (clientId: string) => {
      await sendCommand(clientId, '', 'screenshot')
      await new Promise((r) => setTimeout(r, 500))
      const url = await getClientScreenshotUrl(clientId)
      if (url) setScreenshotUrl(`${url}?${Date.now()}`)
    },
    [sendCommand],
  )

  // ── 驱动器 / 目录 ──
  const getClientDrives = useCallback(
    async (clientId: string) => {
      await sendCommand(clientId, '', 'drives')
      setTimeout(async () => {
        const text = await fetchResultText(clientId)
        try {
          const data = JSON.parse(text)
          if (data.drives) {
            setAvailableDrives(data.drives)
            if (data.drives.length > 0) {
              getClientDirectory(clientId, data.drives[0])
            }
          }
        } catch {
          setAvailableDrives([])
        }
      }, 1500)
    },
    [sendCommand, fetchResultText],
  )

  const getClientDirectory = useCallback(
    async (clientId: string, path: string = 'C:\\') => {
      await sendCommand(clientId, path, 'directory')
      setTimeout(async () => {
        const text = await fetchResultText(clientId)
        try {
          const data = JSON.parse(text)
          if (data.items) {
            setDirectoryItems(data.items)
            setCurrentPath(path)
          }
        } catch {
          setDirectoryItems([])
        }
      }, 1500)
    },
    [sendCommand, fetchResultText],
  )

  // ── 屏幕监控（轮询） ──
  const startScreenView = (clientId: string) => {
    setScreenViewActive(true)
    screenViewActiveRef.current = true
    const loop = async () => {
      if (!screenViewActiveRef.current) return
      await fetchScreenshot(clientId)
      if (screenViewActiveRef.current) {
        screenViewTimerRef.current = window.setTimeout(loop, 3000)
      }
    }
    screenViewTimerRef.current = window.setTimeout(loop, 0)
  }

  const stopScreenView = () => {
    setScreenViewActive(false)
    screenViewActiveRef.current = false
    if (screenViewTimerRef.current) {
      clearTimeout(screenViewTimerRef.current)
      screenViewTimerRef.current = null
    }
  }

  // ── 鼠标 / 键盘 ──
  const handleMouseControl = (
    clientId: string,
    x: number,
    y: number,
    action: string,
  ) => sendCommand(clientId, `${x}|${y}|${action}`, 'mouse')

  const handleKeyboardControl = (
    clientId: string,
    key: string,
    action: string,
  ) => sendCommand(clientId, `${key}|${action}`, 'keyboard')

  const handleRemoteCmd = () => {
    if (!selectedClient || !remoteCommand) return
    const { id } = selectedClient
    sendCommand(id, remoteCommand, commandType)
    setTimeout(async () => {
      setCommandResult(await fetchResultText(id))
    }, 3000)
  }

  // ── 文件操作 ──
  const handleDownloadFile = (clientId: string, filePath: string) => {
    sendCommand(clientId, filePath, 'download')
    showMessage(`正在下载: ${filePath}`, 'success')
  }

  const handleExecuteFile = (clientId: string, filePath: string) => {
    sendCommand(clientId, filePath, 'execute')
    showMessage('文件已执行', 'success')
  }

  const handleRemoteDeleteFile = (
    clientId: string,
    filePath: string,
    fileName: string,
  ) => {
    if (!confirm(`确定要删除文件 "${fileName}" 吗？此操作不可恢复！`)) return
    sendCommand(clientId, filePath, 'delete')
    showMessage('文件已删除', 'success')
    setTimeout(() => getClientDirectory(clientId, currentPath), 1000)
  }

  const handleGoBack = () => {
    if (!selectedClient) return
    const { id } = selectedClient
    if (!currentPath || currentPath === '.' || currentPath === '/') {
      getClientDrives(id)
    } else if (!currentPath.match(/^[A-Za-z]:\\?$/)) {
      const parent = currentPath.substring(0, currentPath.lastIndexOf('\\'))
      if (parent) getClientDirectory(id, parent)
      else getClientDrives(id)
    }
  }

  const handleRemoveClient = async (clientId: string, hostname: string) => {
    if (
      !confirm(
        `确定要删除客户端 "${hostname}" 吗？此操作将从服务端移除该客户端记录，但不会影响客户端本身。`,
      )
    )
      return
    try {
      const result = await removeClient(clientId)
      if (result.status === 'success') {
        showMessage('客户端已删除', 'success')
        if (selectedClient?.id === clientId) setSelectedClient(null)
        fetchClients()
      } else {
        showMessage('删除失败', 'error')
      }
    } catch {
      showMessage('删除失败', 'error')
    }
  }

  // 选中客户端（重置面板）
  const selectClient = (client: RemoteClient) => {
    setSelectedClient(client)
    setScreenshotUrl('')
    setScreenViewActive(false)
    setDirectoryItems([])
    setCommandResult('')
  }

  return {
    // 密码门
    password, authenticated, passwordError,
    setPassword, handleLogin, handleLogout,
    // 客户端
    clients, selectedClient, selectClient, fetchClients,
    // 屏幕
    screenshotUrl, screenViewActive,
    startScreenView, stopScreenView, fetchScreenshot,
    // 文件系统
    directoryItems, currentPath, availableDrives,
    getClientDrives, getClientDirectory,
    // 命令
    remoteCommand, commandResult, commandType,
    setRemoteCommand, setCommandType, handleRemoteCmd,
    // 控制
    handleMouseControl, handleKeyboardControl,
    handleDownloadFile, handleExecuteFile,
    handleRemoteDeleteFile, handleGoBack, handleRemoveClient,
  }
}
