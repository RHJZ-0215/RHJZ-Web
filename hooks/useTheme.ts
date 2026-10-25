import { useEffect, useState } from 'react'
import { applyGlassTheme } from '../utils/glass'
import type { ThemeMode } from '../types'

const STORAGE_KEY = 'rhjz-theme'

/**
 * 主题管理：持久化到 localStorage，同步到 <html data-theme>
 * 并联动旧玻璃材质（applyGlassTheme）。
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('light')

  // 读取持久化主题
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') setTheme(saved)
    } catch {
      /* noop */
    }
  }, [])

  // 应用主题
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* noop */
    }
    applyGlassTheme(theme === 'dark')
  }, [theme])

  const toggleTheme = () =>
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return { theme, isDark: theme === 'dark', setTheme, toggleTheme }
}
