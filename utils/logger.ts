import fs from 'fs/promises';
import path from 'path';

export interface LogEntry {
  id: string;
  timestamp: string;
  ip: string;
  type: 'access' | 'upload' | 'download' | 'login' | 'logout' | 'command' | 'error' | 'system';
  action: string;
  details: string;
  username?: string;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

let logs: LogEntry[] = [];

export async function initLogger() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    try {
      const data = await fs.readFile(LOG_FILE, 'utf-8');
      logs = JSON.parse(data);
    } catch {
      logs = [];
    }
  } catch (error) {
    console.error('Failed to initialize logger:', error);
  }
}

export async function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
  const logEntry: LogEntry = {
    ...entry,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
  };
  
  logs.unshift(logEntry);
  
  // 保留最近1000条日志
  if (logs.length > 1000) {
    logs = logs.slice(0, 1000);
  }
  
  try {
    await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Failed to write log:', error);
  }
  
  return logEntry;
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function getLogsByType(type: LogEntry['type']): LogEntry[] {
  return logs.filter(log => log.type === type);
}

export function getLogsByIp(ip: string): LogEntry[] {
  return logs.filter(log => log.ip === ip);
}

export function formatLog(entry: LogEntry): string {
  const date = new Date(entry.timestamp);
  const formattedDate = date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  const typeColors: Record<LogEntry['type'], string> = {
    access: '\x1b[34m',
    upload: '\x1b[32m',
    download: '\x1b[36m',
    login: '\x1b[33m',
    logout: '\x1b[35m',
    command: '\x1b[92m',
    error: '\x1b[31m',
    system: '\x1b[90m',
  };
  
  const typeNames: Record<LogEntry['type'], string> = {
    access: '访问',
    upload: '上传',
    download: '下载',
    login: '登录',
    logout: '退出',
    command: '命令',
    error: '错误',
    system: '系统',
  };
  
  const reset = '\x1b[0m';
  const typeColor = typeColors[entry.type];
  const typeName = typeNames[entry.type];
  
  return `[${formattedDate}] ${typeColor}[${typeName}]${reset} ${entry.ip} - ${entry.action} ${entry.details}${entry.username ? ` (用户: ${entry.username})` : ''}`;
}