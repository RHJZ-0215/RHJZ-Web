import type { NextApiRequest, NextApiResponse } from 'next'

function isAdmin(req: NextApiRequest): boolean {
  const cookies = req.headers.cookie || ''
  return cookies.includes('admin=authenticated')
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  if (isAdmin(req)) {
    return res.status(200).json({ status: 'success', isAdmin: true })
  }

  return res.status(200).json({ status: 'success', isAdmin: false })
}