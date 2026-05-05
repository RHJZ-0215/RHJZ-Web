import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  res.setHeader('Set-Cookie', `admin=; HttpOnly; Path=/; Max-Age=0`)
  return res.status(200).json({ status: 'success', message: '退出成功' })
}