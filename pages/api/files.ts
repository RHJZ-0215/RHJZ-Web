import type { NextApiRequest, NextApiResponse } from 'next'
import { list } from '@vercel/blob'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  try {
    const { blobs } = await list()
    
    const files = blobs.map(blob => {
      const size = blob.size || 0
      const size_str = size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(2)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`
      
      return {
        name: blob.pathname,
        size: size,
        size_str: size_str,
        mtime: blob.uploadedAt ? new Date(blob.uploadedAt).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        url: blob.url
      }
    })

    res.status(200).json({ files })
  } catch (error: any) {
    console.error('Failed to list files:', error.message)
    res.status(500).json({ status: 'error', message: '获取文件列表失败', error: error.message })
  }
}