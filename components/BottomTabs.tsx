import { useEffect, useRef } from 'react'
import Script from 'next/script'

export interface BottomTabItem {
  key: string
  label: string
  iconPath: string
}

interface BottomTabsProps {
  items: BottomTabItem[]
  activeKey: string
  dark: boolean
  onChange: (key: string) => void
}

// 组件挂载一次，之后只同步选中态与主题；脚本由 next/script 从本地 /vendor 加载
export default function BottomTabs({ items, activeKey, dark, onChange }: BottomTabsProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<any>(null)
  const readyRef = useRef(false)
  // 用 ref 持有最新回调/状态，避免重建元素或闭包旧值导致时序问题
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const itemsRef = useRef(items)
  itemsRef.current = items
  const darkRef = useRef(dark)
  darkRef.current = dark
  const activeKeyRef = useRef(activeKey)
  activeKeyRef.current = activeKey

  // 初始化自定义元素（脚本 onLoad 后 customElements 已注册）
  const mount = () => {
    const host = hostRef.current
    if (!host || elRef.current) return
    const el = document.createElement('liquid-glass') as any
    el.style.cssText = 'width:100%;height:100%;display:block'
    // 匹配屏幕实际分辨率（append 前设置，connectedCallback 才会读取），消除整体拉伸模糊
    el.setAttribute('dpr', '2')
    // 按文档时序：先 append（默认 mode），再 setAttribute('mode') 触发 rebuild
    host.appendChild(el)
    el.setAttribute('mode', 'single-bottom-tabs')
    // 透明背景：不传 wallpaper（默认透明），玻璃直接叠加在页面上
    elRef.current = el
    // rAF 内写入 tab 配置（JS API，避免属性时序问题）
    requestAnimationFrame(() => {
      el.setTabs([
        itemsRef.current.map((it) => ({
          icon: it.iconPath,
          label: it.label,
          viewport: 24,
        })),
      ])
      readyRef.current = true
      syncSelected(activeKeyRef.current)
      syncDark(darkRef.current)
    })
    // 选中态变化（用户点击/拖拽 tab）→ 同步页面（与胶囊移动同步）
    el.addEventListener('lg-statechange', (e: any) => {
      const idx = e.detail?.selectedTab
      const tab = itemsRef.current[idx]
      if (typeof idx === 'number' && tab) {
        onChangeRef.current(tab.key)
      }
    })
  }

  const syncSelected = (key: string) => {
    const el = elRef.current
    if (!el || !readyRef.current) return
    const idx = itemsRef.current.findIndex((it) => it.key === key)
    if (idx < 0) return
    try {
      // 外部切换（如点击首页功能卡片）→ 同步组件内部选中态
      el.setState({ selectedTab: idx })
    } catch {
      /* noop */
    }
  }

  const syncDark = (isDark: boolean) => {
    const el = elRef.current
    if (!el) return
    if (isDark) el.setAttribute('dark', '')
    else el.removeAttribute('dark')
  }

  // 外部 activeKey 变化 → 同步
  useEffect(() => {
    syncSelected(activeKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  // 主题变化 → 同步
  useEffect(() => {
    syncDark(dark)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark])

  // 卸载时移除元素，释放 WebGL context
  useEffect(() => {
    return () => {
      if (elRef.current) {
        elRef.current.remove()
        elRef.current = null
      }
      readyRef.current = false
    }
  }, [])

  return (
    <>
      <Script src="/vendor/liquid-glass.js?v=57" strategy="afterInteractive" onLoad={mount} />
      <div className="bottom-tabs" role="navigation" aria-label="主导航">
        <div className="bottom-tabs__host" ref={hostRef} />
      </div>
    </>
  )
}
