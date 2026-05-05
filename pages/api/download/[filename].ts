import type { NextApiRequest, NextApiResponse } from 'next'
import { list } from '@vercel/blob'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const { filename } = req.query
  const decodedFilename = decodeURIComponent(filename as string)

  try {
    const { blobs } = await list()
    const blob = blobs.find(b => b.pathname === decodedFilename)

    if (!blob) {
      return res.status(404).json({ status: 'error', message: '文件不存在' })
    }

    res.redirect(blob.url)
  } catch (error: any) {
    console.error('Download error:', error.message)
    res.status(500).json({ status: 'error', message: '下载失败', error: error.message })
  }
}