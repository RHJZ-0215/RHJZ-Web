import type { NextApiRequest, NextApiResponse } from 'next'
import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || ''
  return cookies.includes('admin=authenticated')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ status: 'error', message: '未登录或权限不足' })
  }

  const { command } = req.body

  if (!command) {
    return res.status(400).json({ status: 'error', message: '命令不能为空' })
  }

  try {
    const { stdout, stderr } = await execPromise(command, { timeout: 30000 })
    return res.status(200).json({ 
      status: 'success', 
      message: '命令执行成功',
      stdout: stdout || '',
      stderr: stderr || ''
    })
  } catch (error: any) {
    console.error('Command error:', error)
    return res.status(500).json({ 
      status: 'error', 
      message: '命令执行失败',
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    })
  }
}