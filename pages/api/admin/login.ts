import type { NextApiRequest, NextApiResponse } from 'next'
import { addLog } from '../../../utils/logger'

const ADMIN_USERNAME = 'RHJZ'
const ADMIN_PASSWORD = 'rhjz'

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress || 'unknown'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const { username, password } = req.body

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', `admin=authenticated; HttpOnly; Path=/; Max-Age=3600`)
    
    await addLog({
      ip: getClientIp(req),
      type: 'login',
      action: '管理员登录',
      details: '登录成功',
      username: username
    })
    
    return res.status(200).json({ status: 'success', message: '登录成功' })
  }

  await addLog({
    ip: getClientIp(req),
    type: 'login',
    action: '管理员登录',
    details: `登录失败 - 用户名: ${username || '空'}, IP: ${getClientIp(req)}`
  })
  
  return res.status(401).json({ status: 'error', message: '用户名或密码错误' })
}