import type { NextApiRequest, NextApiResponse } from 'next'

const ADMIN_USERNAME = 'RHJZ'
const ADMIN_PASSWORD = 'rhjz'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const { username, password } = req.body

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', `admin=authenticated; HttpOnly; Path=/; Max-Age=3600`)
    return res.status(200).json({ status: 'success', message: '登录成功' })
  }

  return res.status(401).json({ status: 'error', message: '用户名或密码错误' })
}