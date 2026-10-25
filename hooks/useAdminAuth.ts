import { useCallback, useState } from 'react'
import { adminLogin, adminLogout, getAdminStatus } from '../lib/api'

type ShowMessage = (text: string, type: 'success' | 'error') => void

/**
 * 管理员认证：登录态、登录弹窗、登录/登出。
 * checkStatus 在首屏调用，恢复已登录会话。
 */
export function useAdminAuth(showMessage: ShowMessage) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const checkAdminStatus = useCallback(async () => {
    setIsAdmin(await getAdminStatus())
  }, [])

  const handleLogin = async () => {
    try {
      const result = await adminLogin(username, password)
      showMessage(result.message, result.status === 'success' ? 'success' : 'error')
      if (result.status === 'success') {
        setIsAdmin(true)
        setShowLoginModal(false)
        setUsername('')
        setPassword('')
      }
    } catch {
      showMessage('登录失败', 'error')
    }
  }

  const handleLogout = async () => {
    try {
      const result = await adminLogout()
      showMessage(result.message, result.status === 'success' ? 'success' : 'error')
      if (result.status === 'success') setIsAdmin(false)
    } catch {
      showMessage('退出失败', 'error')
    }
  }

  const closeLoginModal = () => {
    setShowLoginModal(false)
    setUsername('')
    setPassword('')
  }

  return {
    isAdmin,
    showLoginModal,
    username,
    password,
    setUsername,
    setPassword,
    setShowLoginModal,
    checkAdminStatus,
    handleLogin,
    handleLogout,
    closeLoginModal,
  }
}
