import { useCallback, useState } from 'react'
import {
  createItem,
  executeCommand,
  getBlobStorage,
  getLogs,
  getServerFiles,
  readFileContent,
  writeFileContent,
} from '../lib/api'
import type { FileItem, LogRecord, ServerFile } from '../types'

type ShowMessage = (text: string, type: 'success' | 'error') => void

/**
 * 管理员工具集：系统日志、服务器文件浏览、文件编辑器、
 * Blob 存储查看、命令执行弹窗、新建文件/目录。
 * 全部为管理员可见面板所需的状态与动作。
 */
export function useAdminTools(showMessage: ShowMessage) {
  // 日志
  const [logs, setLogs] = useState<LogRecord[]>([])
  const [logTypeFilter, setLogTypeFilter] = useState('all')
  const [showLogs, setShowLogs] = useState(false)

  // 服务器文件
  const [showServerFiles, setShowServerFiles] = useState(false)
  const [serverFiles, setServerFiles] = useState<ServerFile[]>([])
  const [serverFilesPath, setServerFilesPath] = useState('.')

  // 新建
  const [showCreateModal, setShowCreateModal] = useState<
    'file' | 'directory' | null
  >(null)
  const [newItemName, setNewItemName] = useState('')

  // 文件编辑器
  const [showFileEditor, setShowFileEditor] = useState(false)
  const [editingFile, setEditingFile] = useState('')
  const [editingContent, setEditingContent] = useState('')

  // Blob 存储
  const [showBlobStorage, setShowBlobStorage] = useState(false)
  const [blobFiles, setBlobFiles] = useState<FileItem[]>([])

  // 程序上传 API 说明
  const [showApiDocs, setShowApiDocs] = useState(false)

  // 命令弹窗
  const [showCmdModal, setShowCmdModal] = useState(false)
  const [command, setCommand] = useState('')
  const [cmdResult, setCmdResult] = useState('')
  const [currentDir, setCurrentDir] = useState('')

  // ── 日志 ──
  const fetchLogs = useCallback(
    async (type: string = logTypeFilter) => {
      setLogs(await getLogs(type))
    },
    [logTypeFilter],
  )

  // ── 服务器文件 ──
  const fetchServerFiles = useCallback(async (dir?: string) => {
    try {
      const { files, path } = await getServerFiles(dir)
      setServerFiles(files)
      setServerFilesPath(path)
    } catch {
      showMessage('获取服务器文件失败', 'error')
    }
  }, [showMessage])

  const navigateToServerDir = (dir: string) => fetchServerFiles(dir)

  const goToParentDir = () => {
    if (serverFilesPath === '.') return
    const parts = serverFilesPath.split('/')
    parts.pop()
    fetchServerFiles(parts.join('/') || '.')
  }

  // ── 文件编辑器 ──
  const openFileEditor = async (filePath: string) => {
    try {
      const content = await readFileContent(filePath)
      setEditingFile(filePath)
      setEditingContent(content)
      setShowFileEditor(true)
    } catch {
      showMessage('打开文件失败', 'error')
    }
  }

  const saveFile = async () => {
    try {
      const result = await writeFileContent(editingFile, editingContent)
      showMessage(
        result.message,
        result.status === 'success' ? 'success' : 'error',
      )
      if (result.status === 'success') {
        setShowFileEditor(false)
        fetchServerFiles(serverFilesPath)
      }
    } catch {
      showMessage('保存文件失败', 'error')
    }
  }

  // ── 新建 ──
  const createNewItem = async () => {
    if (!newItemName.trim()) {
      showMessage('请输入名称', 'error')
      return
    }
    try {
      const result = await createItem(
        showCreateModal as 'file' | 'directory',
        newItemName,
        serverFilesPath === '.' ? '' : serverFilesPath,
      )
      showMessage(
        result.message,
        result.status === 'success' ? 'success' : 'error',
      )
      if (result.status === 'success') {
        setShowCreateModal(null)
        setNewItemName('')
        fetchServerFiles(serverFilesPath)
      }
    } catch {
      showMessage('创建失败', 'error')
    }
  }

  // ── Blob 存储 ──
  const fetchBlobStorage = useCallback(async () => {
    setBlobFiles(await getBlobStorage())
  }, [])

  // ── 命令执行 ──
  const handleExecuteCommand = async () => {
    if (!command.trim()) {
      showMessage('请输入命令', 'error')
      return
    }
    try {
      const result = await executeCommand(command)
      if (result.cwd) setCurrentDir(result.cwd)
      let output = ''
      if (result.stdout) output += `标准输出:\n${result.stdout}\n\n`
      if (result.stderr) output += `错误输出:\n${result.stderr}`
      setCmdResult(output || result.message)
      showMessage(
        result.message,
        result.status === 'success' ? 'success' : 'error',
      )
    } catch {
      showMessage('命令执行失败', 'error')
    }
  }

  return {
    // 日志
    logs, logTypeFilter, showLogs,
    setLogTypeFilter, setShowLogs, fetchLogs,
    // 服务器文件
    showServerFiles, serverFiles, serverFilesPath,
    setShowServerFiles, fetchServerFiles, navigateToServerDir, goToParentDir,
    // 新建
    showCreateModal, newItemName,
    setShowCreateModal, setNewItemName, createNewItem,
    // 编辑器
    showFileEditor, editingFile, editingContent,
    setShowFileEditor, setEditingContent, openFileEditor, saveFile,
    // Blob
    showBlobStorage, blobFiles,
    setShowBlobStorage, fetchBlobStorage,
    // 程序上传 API
    showApiDocs, setShowApiDocs,
    // 命令弹窗
    showCmdModal, command, cmdResult, currentDir,
    setShowCmdModal, setCommand, setCmdResult, handleExecuteCommand,
  }
}
