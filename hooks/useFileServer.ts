import { useCallback, useEffect, useRef, useState } from 'react'
import { getFiles, uploadFile } from '../lib/api'
import type { FileItem } from '../types'

type ShowMessage = (text: string, type: 'success' | 'error') => void

/**
 * 文件服务器：公开文件列表 + 上传（点击/拖拽）。
 * 上传区高亮样式直接操作 DOM，与原行为保持一致。
 */
export function useFileServer(showMessage: ShowMessage) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFileName, setSelectedFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAreaRef = useRef<HTMLDivElement>(null)

  const fetchFiles = useCallback(async () => {
    setFiles(await getFiles())
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFileName(e.target.files[0].name)
    }
  }

  const setHover = (active: boolean) => {
    const el = uploadAreaRef.current
    if (!el) return
    el.style.borderColor = active ? '#4a6bff' : 'rgba(59,91,255,0.35)'
    el.style.backgroundColor = active
      ? 'rgba(255,255,255,0.34)'
      : 'rgba(255,255,255,0.2)'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setHover(true)
  }

  const handleDragLeave = () => setHover(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setHover(false)
    if (e.dataTransfer.files.length > 0 && fileInputRef.current) {
      fileInputRef.current.files = e.dataTransfer.files
      setSelectedFileName(e.dataTransfer.files[0].name)
    }
  }

  const handleUpload = async () => {
    const input = fileInputRef.current
    if (!input || !input.files || input.files.length === 0) {
      showMessage('请先选择文件', 'error')
      return
    }
    try {
      const result = await uploadFile(input.files[0])
      if (!result || typeof result.status !== 'string') {
        showMessage('上传失败，响应格式错误', 'error')
        return
      }
      if (result.status !== 'success') {
        const msg = result.details
          ? `${result.message}: ${result.details}`
          : result.message || '上传失败'
        showMessage(msg, 'error')
        return
      }
      const ok = result.filename
        ? `${result.message} - ${result.filename}`
        : result.message
      showMessage(ok, 'success')
      setSelectedFileName('')
      input.value = ''
      fetchFiles()
    } catch (e: any) {
      showMessage(e?.message || '上传失败，请重试', 'error')
    }
  }

  return {
    files,
    selectedFileName,
    fileInputRef,
    uploadAreaRef,
    fetchFiles,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleUpload,
  }
}
