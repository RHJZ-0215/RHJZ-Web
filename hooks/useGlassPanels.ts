import { useEffect, useRef } from 'react'
import { createGlassInstance, destroyGlass } from '../utils/glass'

/**
 * 常驻玻璃面板（header + tab 内容区）：挂载时创建一次，卸载时销毁。
 * 渲染像素与材质集中在此，避免散落在页面组件中。
 */
export function useStableGlass() {
  const stableGlassRef = useRef<any[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const headerInst = await createGlassInstance('header', {
        frost: 0.26, tint: 0.22, tintTone: 'light', opacity: 0.9, maxDpr: 1.25,
      })
      if (cancelled) {
        if (headerInst) destroyGlass([headerInst])
        return
      }
      stableGlassRef.current.push(headerInst)

      const contentInst = await createGlassInstance('.tab-content', {
        targets: '.card, .feature-card, .auth-card, .hero-section, .client-item',
        frost: 0.34, tint: 0.24, tintTone: 'light', opacity: 0.92, maxDpr: 1.25,
      })
      if (cancelled) {
        if (contentInst) destroyGlass([contentInst])
        return
      }
      stableGlassRef.current.push(contentInst)
    })()

    return () => {
      cancelled = true
      destroyGlass(stableGlassRef.current)
    }
  }, [])
}

/**
 * 弹窗玻璃：随弹窗开合重建（依赖为各弹窗可见状态）。
 * 传入当前应触发重建的弹窗状态数组。
 */
export function useModalGlass(deps: unknown[]) {
  const modalGlassRef = useRef<any[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      destroyGlass(modalGlassRef.current)
      const panels = Array.from(document.querySelectorAll('.modal-glass'))
      for (const panel of panels) {
        const inst = await createGlassInstance(panel as HTMLElement, {
          frost: 0.45, tint: 0.36, tintTone: 'light', opacity: 0.97, maxDpr: 1.25,
        })
        if (cancelled) {
          if (inst) destroyGlass([inst])
          return
        }
        modalGlassRef.current.push(inst)
      }
    })()

    return () => {
      cancelled = true
      destroyGlass(modalGlassRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
