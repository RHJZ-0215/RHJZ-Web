import { useCallback, useRef, useState } from 'react'
import type { ToastType } from '../types'

/**
 * Toast 全局提示：3 秒自动消失。
 * 用 ref 持有计时器，连续触发时重置，避免提前消失。
 */
export function useToast() {
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<ToastType>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setMessage('')
      setMessageType('')
    }, 3000)
  }, [])

  return { message, messageType, showMessage }
}
