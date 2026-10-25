// ─────────────────────────────────────────────────────────────
// 全局共享类型：前端各模块、hooks、视图组件复用
// ─────────────────────────────────────────────────────────────

/** 公开文件列表项（来自 /api/files，Vercel Blob） */
export interface FileItem {
  name: string
  size: number
  size_str: string
  mtime: string
  url?: string
}

/** 底部标签页 key */
export type ActiveTab = 'home' | 'fileServer' | 'remoteServer'

/** 深浅主题 */
export type ThemeMode = 'light' | 'dark'

/** Toast 提示类型 */
export type ToastType = 'success' | 'error' | ''

/** 管理员控制台日志类型 */
export type LogType =
  | 'access'
  | 'upload'
  | 'download'
  | 'login'
  | 'logout'
  | 'command'
  | 'error'
  | 'system'

/** 前端展示的日志记录（/api/admin/logs） */
export interface LogRecord {
  id: string
  timestamp: string
  ip: string
  type: LogType
  action: string
  details: string
  username?: string
}

/** 服务器本地文件项（/api/admin/serverFiles） */
export interface ServerFile {
  name: string
  type: 'file' | 'directory'
  size?: number
  mtime?: string
  path: string
}

/** 远程客户端信息（/api/admin/clients） */
export interface RemoteClient {
  id: string
  ip: string
  country: string
  city: string
  isp: string
  hostname: string
  os: string
  username: string
  cpu: string
  ram: string
  lastHeartbeat: number
  status: 'online' | 'offline'
  screenshotUrl?: string
}

/** 远程客户端文件系统项 */
export interface RemoteFsItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  path: string
}

/** 通用 API 响应包装 */
export interface ApiResult<T = unknown> {
  status: 'success' | 'error'
  message: string
  data?: T
  [key: string]: unknown
}
