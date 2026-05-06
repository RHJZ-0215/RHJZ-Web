import type { NextApiRequest, NextApiResponse } from 'next'
import { addLog } from '../../../utils/logger'

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

  await addLog({
    ip: getClientIp(req),
    type: 'logout',
    action: '管理员退出',
    details: '退出成功'
  })

  res.setHeader('Set-Cookie', `admin=; HttpOnly; Path=/; Max-Age=0`)
  return res.status(200).json({ status: 'success', message: '退出成功' })
}