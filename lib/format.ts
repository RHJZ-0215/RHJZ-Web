// ─────────────────────────────────────────────────────────────
// 通用格式化工具：纯函数，无副作用，可在任意模块复用
// ─────────────────────────────────────────────────────────────

/** 字节数 → 人类可读大小 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** 日志类型 → 中文名 */
export const LOG_TYPE_NAMES: Record<string, string> = {
  all: '全部',
  access: '访问',
  upload: '上传',
  download: '下载',
  login: '登录',
  logout: '退出',
  command: '命令',
  error: '错误',
  system: '系统',
}

/** 日志类型 → 展示色（与原页面一致） */
export const LOG_TYPE_COLORS: Record<string, string> = {
  access: '#3b5bff',
  upload: '#00b894',
  download: '#3b5bff',
  login: '#f39c12',
  logout: '#7a4dff',
  command: '#1abc9c',
  error: '#ff4d5e',
  system: '#95a5a6',
}

/** 日志类型筛选器顺序 */
export const LOG_FILTERS = [
  'all', 'access', 'upload', 'download',
  'login', 'logout', 'command', 'error', 'system',
] as const
