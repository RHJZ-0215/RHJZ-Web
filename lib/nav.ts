import type { BottomTabItem } from '../components/BottomTabs'

/**
 * 底部标签栏配置：GooseHyperGlass（<liquid-glass>），
 * 图标为 Material SVG path（viewport 24）。
 */
export const BOTTOM_TABS: BottomTabItem[] = [
  {
    key: 'home',
    label: '首页',
    iconPath: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  },
  {
    key: 'fileServer',
    label: '文件服务器',
    iconPath:
      'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z',
  },
  {
    key: 'remoteServer',
    label: '远程服务端',
    iconPath:
      'M7 19c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7 1c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM19 3H9c-1.1 0-2 .9-2 2s.9 2 2 2h10c1.1 0 2-.9 2-2s-.9-2-2-2zm0 9H9c-1.1 0-2 .9-2 2s.9 2 2 2h10c1.1 0 2-.9 2-2s-.9-2-2-2zm0 9H9c-1.1 0-2 .9-2 2s.9 2 2 2h10c1.1 0 2-.9 2-2s-.9-2-2-2z',
  },
]
